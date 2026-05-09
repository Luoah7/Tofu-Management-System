import React, { useEffect, useMemo, useState } from 'react';
import { Button, Drawer, Input, InputNumber, Modal, Select, Spin, message } from 'antd';
import { DatePicker as MobileDatePicker } from 'antd-mobile';
import { ChevronRight, ClipboardPaste, FileSearch, FileText, Minus, Package, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '@/api/client';
import { EmptyState, SectionHeading, TaskCard } from '@/components/mobile/shared';
import {
  TASK_ITEM_UNITS,
  formatTaskItemMeasure,
  getTaskItemMin,
  getTaskItemStep,
  normalizeTaskItemInput,
  type TaskItemUnit,
} from '@/shared/task-item';

type Task = {
  id: string;
  taskDate: string;
  merchantName: string;
  status: string;
  plannedWeight: number;
  actualWeight: number;
  completedAt?: string;
  routeEta: string;
  createdAt?: string;
  items: Array<{
    productName: string;
    plannedWeight: number;
    displayAmount?: number;
    displayUnit?: TaskItemUnit;
  }>;
};

type Merchant = {
  id: string;
  name: string;
  type: string;
  phone: string;
  address: string;
  settlementDay: string;
  status: string;
};

type ProductSpec = {
  id: string;
  label: string;
  unitPrice: number;
};

type Product = {
  id: string;
  name: string;
  category: string;
  status: string;
  specs: ProductSpec[];
};

type EntryLine = {
  id: string;
  productId: string;
  specId: string;
  displayAmount: number;
  displayUnit: TaskItemUnit;
};

type EntryMode = 'paste' | 'manual';

type PreviewTask = {
  id: string;
  taskDate: string;
  merchantId: string;
  merchantName: string;
  merchantType: string;
  address: string;
  phone: string;
  settlementDay: string;
  routeEta: string;
  plannedWeight: number;
  items: Array<{
    id: string;
    productId: string;
    specId: string;
    productName: string;
    specLabel: string;
    unitPrice: number;
    displayAmount: number;
    displayUnit: TaskItemUnit;
    plannedWeight: number;
    source?: 'rule' | 'model';
    needsConfirmation?: boolean;
  }>;
  warnings?: string[];
};

type PreviewStats = {
  totalLines: number;
  ruleMatchedCount: number;
  modelFallbackCount: number;
  unrecognizedCount: number;
  skippedMerchantCount: number;
};

type EntryItem = EntryLine & {
  product: Product | null;
  spec: ProductSpec | null;
  productName: string;
  specLabel: string;
  unitPrice: number;
  plannedWeight: number;
};

const STATUS_TABS = [
  { key: 'pending', label: '待处理' },
  { key: 'all', label: '全部' },
  { key: 'completed', label: '已归档' },
] as const;

function parseDateValue(value: string, fallback = new Date()) {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.toDate() : fallback;
}

function MobileDateField({
  value,
  onChange,
  precision = 'day',
}: {
  value: string;
  onChange: (value: string) => void;
  precision?: 'day' | 'month';
}) {
  return (
    <MobileDatePicker
      precision={precision}
      value={parseDateValue(value)}
      onConfirm={(date) => onChange(dayjs(date).format(precision === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD'))}
    >
      {(pickerValue, actions) => (
        <button type="button" className="mobile-date-trigger" onClick={actions.open}>
          <span>{dayjs(pickerValue).format(precision === 'month' ? 'YYYY年M月' : 'YYYY年M月D日')}</span>
          <span>选择</span>
        </button>
      )}
    </MobileDatePicker>
  );
}

function createLine(products: Product[]): EntryLine {
  const firstProduct = products[0];
  const firstSpec = firstProduct?.specs[0];
  return {
    id: `line_${Math.random().toString(36).slice(2, 8)}`,
    productId: firstProduct?.id || '',
    specId: firstSpec?.id || '',
    displayAmount: 1,
    displayUnit: '斤',
  };
}

function parseArchivedTime(task: Task) {
  if (!task.completedAt) return 0;
  const normalized = task.completedAt.replace(/-/g, '/');
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function parseCreatedTime(task: Task) {
  const source = task.createdAt || `${task.taskDate} 00:00:00`;
  const normalized = source.replace(/-/g, '/');
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function toPreviewTask(raw: Omit<PreviewTask, 'id'>): PreviewTask {
  return {
    ...raw,
    id: `${raw.merchantId}_${Math.random().toString(36).slice(2, 8)}`,
    items: raw.items.map(item => ({
      ...item,
      id: `${item.productId}_${item.specId}_${Math.random().toString(36).slice(2, 8)}`,
      displayAmount: Number(item.displayAmount || item.plannedWeight || 0),
      displayUnit: item.displayUnit || '斤',
    })),
  };
}

function buildItems(lines: EntryLine[], products: Product[]): EntryItem[] {
  return lines.map((line) => {
    const product = products.find(item => item.id === line.productId) || null;
    const specs = product?.specs || [];
    const spec = specs.find(item => item.id === line.specId) || specs[0] || null;
    const normalized = normalizeTaskItemInput({
      displayAmount: line.displayAmount,
      displayUnit: line.displayUnit,
    });

    return {
      ...line,
      product,
      spec,
      productId: product?.id || '',
      specId: spec?.id || '',
      productName: product?.name || '',
      specLabel: spec?.label || '',
      unitPrice: spec?.unitPrice || 0,
      displayAmount: normalized.displayAmount,
      displayUnit: normalized.displayUnit,
      plannedWeight: normalized.plannedWeight,
    };
  });
}

function itemPayload(items: EntryItem[]) {
  return items
    .filter(item => item.product && item.spec && item.plannedWeight > 0)
    .map(item => ({
      productId: item.productId,
      specId: item.specId,
      productName: item.productName,
      specLabel: item.specLabel,
      unitPrice: item.unitPrice,
      quantity: 1,
      displayAmount: item.displayAmount,
      displayUnit: item.displayUnit,
      plannedWeight: item.plannedWeight,
    }));
}

function EntryItemsEditor({
  lines,
  products,
  onChange,
}: {
  lines: EntryLine[];
  products: Product[];
  onChange: (lines: EntryLine[]) => void;
}) {
  const items = useMemo(() => buildItems(lines, products), [lines, products]);

  const stepAmount = (lineId: string, delta: number) => {
    const line = lines.find(item => item.id === lineId);
    if (!line) return;
    const min = getTaskItemMin(line.displayUnit);
    changeLine(lineId, {
      displayAmount: Math.max(min, Number((line.displayAmount + delta).toFixed(1))),
    });
  };

  const changeLine = (lineId: string, patch: Partial<EntryLine>) => {
    onChange(lines.map((line) => {
      if (line.id !== lineId) return line;
      const next = { ...line, ...patch };
      if (patch.productId) {
        const product = products.find(item => item.id === patch.productId);
        next.specId = product?.specs[0]?.id || '';
      }
      const normalized = normalizeTaskItemInput({
        displayAmount: next.displayAmount,
        displayUnit: next.displayUnit,
      });
      return {
        ...next,
        displayAmount: normalized.displayAmount,
        displayUnit: normalized.displayUnit,
      };
    }));
  };

  const totalWeight = items.reduce((sum, item) => sum + item.plannedWeight, 0);

  return (
    <>
      <div className="mobile-entry-lines">
        {items.map((item) => (
          <div key={item.id} className="mobile-entry-line">
            <div className="mobile-entry-line__selectors">
              <Select
                value={item.productId || undefined}
                onChange={(value) => changeLine(item.id, { productId: value })}
                options={products.map(product => ({ value: product.id, label: product.name }))}
                placeholder="商品"
                size="large"
              />
              <Select
                value={item.specId || undefined}
                onChange={(value) => changeLine(item.id, { specId: value })}
                options={(item.product?.specs || []).map(spec => ({ value: spec.id, label: spec.label }))}
                placeholder="规格"
                size="large"
              />
            </div>

            <div className="mobile-entry-line__measure">
              <div className="mobile-stepper">
                <button
                  type="button"
                  onClick={() => stepAmount(item.id, -getTaskItemStep(item.displayUnit))}
                  aria-label="减少"
                >
                  <Minus size={15} />
                </button>
                <InputNumber
                  controls={false}
                  min={getTaskItemMin(item.displayUnit)}
                  step={getTaskItemStep(item.displayUnit)}
                  value={item.displayAmount}
                  onChange={(value) => changeLine(item.id, { displayAmount: Number(value || 0) })}
                />
                <button
                  type="button"
                  onClick={() => stepAmount(item.id, getTaskItemStep(item.displayUnit))}
                  aria-label="增加"
                >
                  <Plus size={15} />
                </button>
              </div>
              <Select
                value={item.displayUnit}
                onChange={(value) => changeLine(item.id, { displayUnit: value })}
                options={TASK_ITEM_UNITS.map(unit => ({ value: unit, label: unit }))}
              />
              <button
                type="button"
                className="mobile-inline-action mobile-inline-action--danger"
                onClick={() => onChange(lines.length === 1 ? lines : lines.filter(line => line.id !== item.id))}
              >
                删除
              </button>
            </div>

            <div className="mobile-entry-line__total">
              <span>{formatTaskItemMeasure(item.displayAmount, item.displayUnit)}</span>
              <strong>{item.plannedWeight.toFixed(1)}斤</strong>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="mobile-inline-action mobile-inline-action--full" onClick={() => onChange([...lines, createLine(products)])}>
        + 添加商品
      </button>

      <div className="mobile-entry-total">
        <span>合计</span>
        <strong>{totalWeight.toFixed(1)} 斤</strong>
      </div>
    </>
  );
}

export default function MobileTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<(typeof STATUS_TABS)[number]['key']>('pending');
  const [createOpen, setCreateOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>('paste');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [previewTasks, setPreviewTasks] = useState<PreviewTask[]>([]);
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const [previewUnrecognizedSegments, setPreviewUnrecognizedSegments] = useState<string[]>([]);
  const [previewSkippedMerchants, setPreviewSkippedMerchants] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewEditingId, setPreviewEditingId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [manualMerchantId, setManualMerchantId] = useState('');
  const [taskDate, setTaskDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'));
  const [manualLines, setManualLines] = useState<EntryLine[]>([]);
  const navigate = useNavigate();

  const loadTasks = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeTab !== 'pending' && selectedMonth) params.set('month', selectedMonth);
    if (activeTab !== 'pending' && selectedMerchantId) params.set('merchantId', selectedMerchantId);
    api.get<Task[]>(`/tasks?${params.toString()}`)
      .then((list) => setTasks(list))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTasks();
  }, [activeTab, selectedMonth, selectedMerchantId]);

  useEffect(() => {
    api.get<Merchant[]>('/merchants')
      .then(list => setMerchants(list.filter(item => item.status !== '停用')))
      .catch(() => { });
  }, []);

  const syncLines = (catalog: Product[], previousLines: EntryLine[]) => {
    if (catalog.length === 0) return [];
    if (previousLines.length === 0) return [createLine(catalog)];

    return previousLines.map((line) => {
      const product = catalog.find(item => item.id === line.productId) || catalog[0];
      const spec = product?.specs.find(item => item.id === line.specId) || product?.specs[0];
      return {
        ...line,
        productId: product?.id || '',
        specId: spec?.id || '',
      };
    });
  };

  const openCreate = async () => {
    setCreateOpen(true);
    setCreateLoading(true);
    setEntryMode('paste');
    setPasteText('');
    setPreviewTasks([]);
    setPreviewStats(null);
    setPreviewUnrecognizedSegments([]);
    setPreviewSkippedMerchants([]);
    setPreviewEditingId('');
    setTaskDate(dayjs().add(1, 'day').format('YYYY-MM-DD'));

    try {
      const [merchantList, productList] = await Promise.all([
        api.get<Merchant[]>('/merchants'),
        api.get<Product[]>('/products'),
      ]);

      const activeMerchants = merchantList.filter(item => item.status !== '停用');
      const activeProducts = productList
        .filter(item => item.status !== '停用')
        .map(item => ({
          ...item,
          specs: item.specs.filter(spec => Boolean(spec.id)),
        }))
        .filter(item => item.specs.length > 0);

      setMerchants(activeMerchants);
      setProducts(activeProducts);
      setManualMerchantId((currentId) => (
        activeMerchants.some(item => item.id === currentId)
          ? currentId
          : activeMerchants[0]?.id || ''
      ));
      setManualLines((currentLines) => syncLines(activeProducts, currentLines));
    } catch (err: any) {
      message.error(err.message || '商户或商品数据加载失败');
    } finally {
      setCreateLoading(false);
    }
  };

  const manualMerchant = merchants.find(item => item.id === manualMerchantId) || null;
  const manualItems = useMemo(() => buildItems(manualLines, products), [manualLines, products]);
  const previewEditing = previewTasks.find(task => task.id === previewEditingId) || null;

  const handleSubmitPaste = async () => {
    const normalizedText = pasteText.trim();
    if (!normalizedText) {
      message.warning('先填批量导入内容');
      return;
    }

    setSubmitLoading(true);
    try {
      const result = await api.post<{
        tasks: Array<Omit<PreviewTask, 'id'>>;
        skippedMerchants: string[];
        unrecognizedSegments: string[];
        stats: PreviewStats;
      }>('/tasks/preview-wechat', {
        text: normalizedText,
        date: taskDate,
      });
      setPreviewTasks(result.tasks.map(toPreviewTask));
      setPreviewStats(result.stats || null);
      setPreviewUnrecognizedSegments(result.unrecognizedSegments || []);
      setPreviewSkippedMerchants(result.skippedMerchants || []);
      setPreviewEditingId('');
      setPreviewOpen(true);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSubmitManual = async () => {
    if (!manualMerchant) {
      message.warning('先选商户');
      return;
    }

    const items = itemPayload(manualItems);
    if (items.length === 0) {
      message.warning('先添加商品');
      return;
    }

    setSubmitLoading(true);
    try {
      await api.post('/tasks', {
        taskDate,
        merchantId: manualMerchant.id,
        merchantName: manualMerchant.name,
        merchantType: manualMerchant.type,
        address: manualMerchant.address,
        phone: manualMerchant.phone,
        settlementDay: manualMerchant.settlementDay,
        routeEta: '',
        items,
      });
      message.success('任务已创建');
      setCreateOpen(false);
      setManualLines([createLine(products)]);
      setActiveTab('pending');
      loadTasks();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const updatePreviewTask = (taskId: string, patch: Partial<PreviewTask>) => {
    setPreviewTasks(prev => prev.map((task) => {
      if (task.id !== taskId) return task;
      const next = { ...task, ...patch };
      return {
        ...next,
        plannedWeight: next.items.reduce((sum, item) => sum + item.plannedWeight, 0),
      };
    }));
  };

  const updatePreviewLines = (taskId: string, lines: EntryLine[]) => {
    const items = itemPayload(buildItems(lines, products)).map(item => ({
      ...item,
      id: `${item.productId}_${item.specId}_${Math.random().toString(36).slice(2, 8)}`,
    }));
    updatePreviewTask(taskId, { items });
  };

  const handleConfirmPreview = async () => {
    const importableTasks = previewTasks.filter(task => task.items.length > 0);
    if (importableTasks.length === 0) {
      message.warning('没有可导入任务');
      return;
    }

    setSubmitLoading(true);
    try {
      await Promise.all(importableTasks.map((task) => api.post('/tasks', {
        taskDate: task.taskDate,
        merchantId: task.merchantId,
        merchantName: task.merchantName,
        merchantType: task.merchantType,
        address: task.address,
        phone: task.phone,
        settlementDay: task.settlementDay,
        routeEta: '',
        items: task.items,
      })));
      message.success(`已导入 ${importableTasks.length} 个任务`);
      setPreviewOpen(false);
      setCreateOpen(false);
      setPasteText('');
      setPreviewTasks([]);
      setPreviewStats(null);
      setPreviewUnrecognizedSegments([]);
      setPreviewSkippedMerchants([]);
      setPreviewEditingId('');
      setActiveTab('pending');
      loadTasks();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteTask = (task: Task) => {
    Modal.confirm({
      title: '删除任务',
      content: `删除 ${task.merchantName} 的任务后不能恢复`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await api.del(`/tasks/${task.id}`);
        message.success('任务已删除');
        loadTasks();
      },
    });
  };

  const pendingTasks = tasks
    .filter(task => task.status !== '已完成' && task.status !== '异常')
    .sort((a, b) => parseCreatedTime(b) - parseCreatedTime(a));
  const allTasks = [...tasks].sort((a, b) => parseCreatedTime(b) - parseCreatedTime(a));
  const archivedTasks = tasks
    .filter(task => task.status === '已完成' || task.status === '异常')
    .sort((a, b) => parseArchivedTime(b) - parseArchivedTime(a));
  const monthPendingCount = tasks.filter(task => task.status !== '已完成' && task.status !== '异常').length;
  const archivedCount = archivedTasks.length;

  const tabFiltered = activeTab === 'all'
    ? allTasks
    : activeTab === 'pending'
      ? pendingTasks
      : archivedTasks;

  const filtered = tabFiltered.filter((task) => {
    if (!keyword.trim()) return true;
    const value = keyword.trim();
    return task.merchantName.includes(value) || task.items.some(item => item.productName.includes(value));
  });

  const pendingDateGroups = filtered.reduce<Array<{ taskDate: string; tasks: Task[] }>>((groups, task) => {
    const group = groups.find(item => item.taskDate === task.taskDate);
    if (group) {
      group.tasks.push(task);
    } else {
      groups.push({ taskDate: task.taskDate, tasks: [task] });
    }
    return groups;
  }, []);

  const previewLines = previewEditing
    ? previewEditing.items.map(item => ({
      id: item.id,
      productId: item.productId,
      specId: item.specId,
      displayAmount: item.displayAmount,
      displayUnit: item.displayUnit,
    }))
    : [];

  if (loading) {
    return (
      <div className="mobile-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="mobile-page">
      <section className="mobile-hero mobile-rise">
        <div className="mobile-hero__corner">
          <span>任务</span>
          <strong>{filtered.length}</strong>
        </div>

        <div className="mobile-hero__eyebrow">任务总览</div>
        <div className="mobile-hero__title">{activeTab === 'pending' ? '待处理' : activeTab === 'completed' ? '已归档' : '全部任务'}</div>
        <div className="mobile-hero__meta">
          <span>{activeTab === 'pending' ? '全部待处理' : selectedMonth}</span>
          <span>待处理 {monthPendingCount} 单</span>
          <span>已归档 {archivedCount} 单</span>
        </div>
      </section>

      <div className="mobile-toolbar mobile-rise" style={{ animationDelay: '70ms' }}>
        <Button type="primary" className="mobile-primary-button" icon={<Plus size={16} />} onClick={openCreate}>
          新增任务
        </Button>
      </div>

      <div className="mobile-pill-row mobile-rise" style={{ animationDelay: '90ms' }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab !== 'pending' ? (
        <div className="mobile-task-filters mobile-rise" style={{ animationDelay: '100ms' }}>
          <div className="mobile-task-filters__row">
            <MobileDateField value={selectedMonth} onChange={setSelectedMonth} precision="month" />
            <Select
              allowClear
              value={selectedMerchantId || undefined}
              onChange={(value) => setSelectedMerchantId(value || '')}
              options={merchants.map(item => ({ value: item.id, label: item.name }))}
              placeholder="筛选商户"
            />
          </div>
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索商户或商品"
            prefix={<FileSearch size={15} />}
          />
        </div>
      ) : null}

      <SectionHeading
        title={activeTab === 'pending' ? '待处理任务' : activeTab === 'completed' ? '已完成与异常' : '全部任务'}
        extra={`${filtered.length} 单`}
      />

      {activeTab === 'pending' ? (
        pendingDateGroups.length === 0 ? (
          <EmptyState title="待处理清空了" />
        ) : (
          <div className="mobile-pending-board">
            {pendingDateGroups.map((group, groupIndex) => (
              <section
                key={group.taskDate}
                className="mobile-pending-group mobile-rise"
                style={{ animationDelay: `${120 + groupIndex * 70}ms` }}
              >
                <div className="mobile-pending-group__head">
                  <div className="mobile-pending-group__badge">
                    <Package size={18} />
                  </div>
                  <div className="mobile-pending-group__title">{group.taskDate}</div>
                  <div className="mobile-pending-group__count">{group.tasks.length}</div>
                </div>

                <div className="mobile-pending-stack">
                  {group.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => navigate(`/mobile/tasks/${task.id}`)}
                      onDelete={task.status === '待配货' ? () => handleDeleteTask(task) : undefined}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <EmptyState title="没有任务" />
      ) : (
        filtered.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            lead={task.taskDate}
            delayMs={150 + index * 60}
            onClick={() => navigate(`/mobile/tasks/${task.id}`)}
            onDelete={task.status === '待配货' ? () => handleDeleteTask(task) : undefined}
          />
        ))
      )}

      <Drawer
        title="新增任务"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        placement="bottom"
        height="88vh"
        rootClassName="mobile-sheet"
        closeIcon={null}
      >
        <div className="mobile-sheet__head">
          <div className="mobile-sheet__title">新增任务</div>
          <button type="button" className="mobile-sheet__close" onClick={() => setCreateOpen(false)}>
            关闭
          </button>
        </div>

        <div className="mobile-entry-switch">
          <button
            type="button"
            className={`mobile-entry-switch__item ${entryMode === 'paste' ? 'is-active' : ''}`.trim()}
            onClick={() => setEntryMode('paste')}
          >
            <ClipboardPaste size={16} />
            <span>批量导入</span>
          </button>
          <button
            type="button"
            className={`mobile-entry-switch__item ${entryMode === 'manual' ? 'is-active' : ''}`.trim()}
            onClick={() => setEntryMode('manual')}
          >
            <FileText size={16} />
            <span>手动录入</span>
          </button>
        </div>

        {createLoading ? (
          <div className="mobile-sheet__loading">
            <Spin />
          </div>
        ) : entryMode === 'paste' ? (
          <div className="mobile-entry-panel">
            <div className="mobile-field-card__label">预计配送日期</div>
            <MobileDateField value={taskDate} onChange={setTaskDate} />
            <div className="mobile-field-card__label">批量导入内容</div>
            <Input.TextArea
              rows={10}
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder={'东桥：明天早上一盘\n刘记：明天送豆腐，黑豆腐少送，豆干3斤\n东桥超市：豆腐2筐，黑豆腐10斤'}
            />
          </div>
        ) : (
          <div className="mobile-entry-panel">
            <div className="mobile-field-card__label">预计配送日期</div>
            <MobileDateField value={taskDate} onChange={setTaskDate} />
            <div className="mobile-field-card__label">商户</div>
            <Select
              value={manualMerchantId || undefined}
              onChange={setManualMerchantId}
              options={merchants.map(item => ({ value: item.id, label: item.name }))}
              placeholder="选择商户"
              size="large"
            />

            <div className="mobile-entry-summary">
              <div className="mobile-entry-summary__card">
                <span>结算日</span>
                <strong>{manualMerchant?.settlementDay || '-'}</strong>
              </div>
              <div className="mobile-entry-summary__card">
                <span>电话</span>
                <strong>{manualMerchant?.phone || '-'}</strong>
              </div>
            </div>

            <EntryItemsEditor lines={manualLines} products={products} onChange={setManualLines} />
          </div>
        )}

        <div className="mobile-sheet__actions">
          <Button onClick={() => setCreateOpen(false)} size="large">
            取消
          </Button>
          <Button
            type="primary"
            size="large"
            loading={submitLoading}
            onClick={entryMode === 'paste' ? handleSubmitPaste : handleSubmitManual}
          >
            {entryMode === 'manual' ? '保存任务' : '生成预览'}
          </Button>
        </div>
      </Drawer>

      <Drawer
        title="导入预览"
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        placement="bottom"
        height="86vh"
        rootClassName="mobile-sheet"
        closeIcon={null}
      >
        <div className="mobile-sheet__head">
          <div className="mobile-sheet__title">{previewEditing ? previewEditing.merchantName : '导入预览'}</div>
          <button
            type="button"
            className="mobile-sheet__close"
            onClick={() => previewEditing ? setPreviewEditingId('') : setPreviewOpen(false)}
          >
            {previewEditing ? '返回' : '关闭'}
          </button>
        </div>

        {previewEditing ? (
          <div className="mobile-entry-panel">
            <div className="mobile-field-card__label">预计配送日期</div>
            <MobileDateField
              value={previewEditing.taskDate}
              onChange={(value) => updatePreviewTask(previewEditing.id, { taskDate: value })}
            />
            <div className="mobile-entry-summary">
              <div className="mobile-entry-summary__card">
                <span>结算日</span>
                <strong>{previewEditing.settlementDay || '-'}</strong>
              </div>
              <div className="mobile-entry-summary__card">
                <span>电话</span>
                <strong>{previewEditing.phone || '-'}</strong>
              </div>
            </div>
            <EntryItemsEditor
              lines={previewLines}
              products={products}
              onChange={(lines) => updatePreviewLines(previewEditing.id, lines)}
            />
          </div>
        ) : (
          <div className="mobile-record-stack mobile-entry-panel">
            {previewStats ? (
              <div className="mobile-entry-summary">
                <div className="mobile-entry-summary__card">
                  <span>规则识别</span>
                  <strong>{previewStats.ruleMatchedCount} 项</strong>
                </div>
                <div className="mobile-entry-summary__card">
                  <span>模型确认</span>
                  <strong>{previewStats.modelFallbackCount} 项</strong>
                </div>
                <div className="mobile-entry-summary__card">
                  <span>未识别</span>
                  <strong>{previewStats.unrecognizedCount} 条</strong>
                </div>
              </div>
            ) : null}

            {previewUnrecognizedSegments.length > 0 || previewSkippedMerchants.length > 0 ? (
              <div className="mobile-record-card__warnings">
                {previewUnrecognizedSegments.map((segment) => (
                  <div key={segment} className="mobile-record-card__warning">
                    {segment}
                  </div>
                ))}
                {previewSkippedMerchants.map((merchant) => (
                  <div key={merchant} className="mobile-record-card__warning">
                    未匹配商户：{merchant}
                  </div>
                ))}
              </div>
            ) : null}

            {previewTasks.map((task) => (
              <div key={task.id} className="mobile-record-card mobile-record-card--button" onClick={() => setPreviewEditingId(task.id)}>
                <div className="mobile-record-card__head">
                  <div>
                    <div className="mobile-record-card__title">{task.merchantName}</div>
                    <div className="mobile-record-card__meta">
                      <span>{task.taskDate}</span>
                      <span>{task.items.length} 项</span>
                    </div>
                  </div>
                  <div className="mobile-record-card__stat">
                    <span>应配</span>
                    <strong>{task.plannedWeight.toFixed(1)}</strong>
                  </div>
                  <div className="mobile-record-card__open">
                    <ChevronRight size={18} />
                  </div>
                </div>

                <div className="mobile-record-card__rows">
                  {task.items.map((item) => (
                    <div key={item.id} className="mobile-record-card__row">
                      <div>
                        <div>
                          {item.productName}
                          {item.source === 'model' ? '（模型识别，需确认）' : ''}
                        </div>
                        <div className="mobile-record-card__dim">{item.specLabel}</div>
                      </div>
                      <strong>{formatTaskItemMeasure(item.displayAmount, item.displayUnit)}</strong>
                    </div>
                  ))}
                </div>

                {task.warnings && task.warnings.length > 0 ? (
                  <div className="mobile-record-card__warnings">
                    {task.warnings.map((warning) => (
                      <div key={warning} className="mobile-record-card__warning">
                        {warning}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {!previewEditing ? (
          <div className="mobile-sheet__actions">
            <Button onClick={() => setPreviewOpen(false)} size="large">
              返回修改
            </Button>
            <Button type="primary" size="large" loading={submitLoading} onClick={handleConfirmPreview}>
              确认新增
            </Button>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
