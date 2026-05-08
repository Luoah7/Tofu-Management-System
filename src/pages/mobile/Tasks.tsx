import React, { useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, Drawer, Input, InputNumber, Modal, Select, Spin, message } from 'antd';
import { Camera, ClipboardPaste, FileSearch, FileText, Package, Plus, Scale, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '@/api/client';
import { EmptyState, SectionHeading, TaskCard } from '@/components/mobile/shared';
import { groupPendingTasks, type PendingGroupKey } from './task-board';

type Task = {
  id: string;
  merchantName: string;
  status: string;
  plannedWeight: number;
  actualWeight: number;
  completedAt?: string;
  routeEta: string;
  items: Array<{ productName: string; plannedWeight: number }>;
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

type ManualLine = {
  id: string;
  productId: string;
  specId: string;
  plannedWeight: number;
};

type EntryMode = 'paste' | 'manual';

type PreviewTask = {
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
    productId: string;
    specId: string;
    productName: string;
    specLabel: string;
    unitPrice: number;
    plannedWeight: number;
  }>;
  warnings?: string[];
};

const STATUS_TABS = [
  { key: 'pending', label: '待处理' },
  { key: 'all', label: '全部' },
  { key: 'completed', label: '已归档' },
] as const;

const PENDING_GROUPS: Array<{ key: PendingGroupKey; label: string; icon: typeof Package; desc: string }> = [
  { key: '待配货', label: '先配货', icon: Package, desc: '先按订货内容准备货' },
  { key: '待复秤', label: '复秤并拍照', icon: Scale, desc: '称完直接留档照片' },
  { key: '待送达', label: '准备送达', icon: Truck, desc: '重量和照片都齐了，剩下送货确认' },
];

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [manualMerchantId, setManualMerchantId] = useState('');
  const [taskDate, setTaskDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'));
  const [routeEta, setRouteEta] = useState('');
  const [manualLines, setManualLines] = useState<ManualLine[]>([]);
  const navigate = useNavigate();

  const loadTasks = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedDate) params.set('date', selectedDate);
    if (selectedMerchantId) params.set('merchantId', selectedMerchantId);
    api.get<Task[]>(`/tasks?${params.toString()}`).then(setTasks).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTasks();
  }, [selectedDate, selectedMerchantId]);

  useEffect(() => {
    api.get<Merchant[]>('/merchants')
      .then(list => setMerchants(list.filter(item => item.status !== '停用')))
      .catch(() => {});
  }, []);

  const createDefaultLine = (catalog: Product[]): ManualLine => {
    const firstProduct = catalog[0];
    const firstSpec = firstProduct?.specs[0];
    return {
      id: `line_${Math.random().toString(36).slice(2, 8)}`,
      productId: firstProduct?.id || '',
      specId: firstSpec?.id || '',
      plannedWeight: 1,
    };
  };

  const syncManualLines = (catalog: Product[], previousLines: ManualLine[]) => {
    if (catalog.length === 0) return [];
    if (previousLines.length === 0) return [createDefaultLine(catalog)];

    return previousLines.map((line) => {
      const product = catalog.find(item => item.id === line.productId) || catalog[0];
      const specs = product?.specs || [];
      const spec = specs.find(item => item.id === line.specId) || specs[0];

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
    setTaskDate(dayjs().add(1, 'day').format('YYYY-MM-DD'));
    setRouteEta('');

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
      setManualLines((currentLines) => syncManualLines(activeProducts, currentLines));
    } catch (err: any) {
      message.error(err.message || '商户或商品数据加载失败');
    } finally {
      setCreateLoading(false);
    }
  };

  const manualMerchant = merchants.find(item => item.id === manualMerchantId) || null;
  const manualPreview = useMemo(() => manualLines.map((line) => {
    const product = products.find(item => item.id === line.productId) || null;
    const specs = product?.specs || [];
    const spec = specs.find(item => item.id === line.specId) || specs[0] || null;

    return {
      ...line,
      product,
      spec,
    };
  }), [manualLines, products]);

  const manualTotalWeight = manualPreview.reduce((sum, line) => sum + line.plannedWeight, 0);

  const handleManualProductChange = (lineId: string, productId: string) => {
    setManualLines(prev => prev.map((line) => {
      if (line.id !== lineId) return line;
      const product = products.find(item => item.id === productId);
      return {
        ...line,
        productId,
        specId: product?.specs[0]?.id || '',
      };
    }));
  };

  const handleManualSpecChange = (lineId: string, specId: string) => {
    setManualLines(prev => prev.map((line) => line.id === lineId ? { ...line, specId } : line));
  };

  const handleManualWeightChange = (lineId: string, plannedWeight: number) => {
    setManualLines(prev => prev.map((line) => line.id === lineId ? { ...line, plannedWeight } : line));
  };

  const handleAddManualLine = () => {
    setManualLines(prev => [...prev, createDefaultLine(products)]);
  };

  const handleRemoveManualLine = (lineId: string) => {
    setManualLines(prev => prev.length === 1 ? prev : prev.filter(line => line.id !== lineId));
  };

  const handleSubmitPaste = async () => {
    const normalizedText = pasteText.trim();
    if (!normalizedText) {
      message.warning('先填批量导入内容');
      return;
    }

    setSubmitLoading(true);
    try {
      const result = await api.post<{ tasks: PreviewTask[]; skippedMerchants: string[] }>('/tasks/preview-wechat', {
        text: normalizedText,
        date: taskDate,
      });
      setPreviewTasks(result.tasks);
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

    const items = manualPreview
      .filter(line => line.product && line.spec && line.plannedWeight > 0)
      .map(line => ({
        productId: line.product!.id,
        specId: line.spec!.id,
        productName: line.product!.name,
        specLabel: line.spec!.label,
        unitPrice: line.spec!.unitPrice,
        plannedWeight: line.plannedWeight,
      }));

    if (items.length === 0) {
      message.warning('先补商品明细');
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
        routeEta: routeEta.trim(),
        items,
      });
      message.success('任务已创建');
      setCreateOpen(false);
      setRouteEta('');
      setManualLines([createDefaultLine(products)]);
      loadTasks();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleConfirmPreview = async () => {
    if (previewTasks.length === 0) {
      message.warning('没有可导入任务');
      return;
    }

    setSubmitLoading(true);
    try {
      await Promise.all(previewTasks.map((task) => api.post('/tasks', {
        taskDate: task.taskDate,
        merchantId: task.merchantId,
        merchantName: task.merchantName,
        merchantType: task.merchantType,
        address: task.address,
        phone: task.phone,
        settlementDay: task.settlementDay,
        routeEta: task.routeEta,
        items: task.items,
      })));
      message.success(`已导入 ${previewTasks.length} 个任务`);
      setPreviewOpen(false);
      setCreateOpen(false);
      setPasteText('');
      setPreviewTasks([]);
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

  const pendingCount = tasks.filter(task => task.status !== '已完成' && task.status !== '异常').length;
  const archivedCount = tasks.filter(task => task.status === '已完成' || task.status === '异常').length;
  const pendingTasks = tasks.filter(task => task.status !== '已完成' && task.status !== '异常');

  const tabFiltered = activeTab === 'all'
    ? tasks
    : activeTab === 'pending'
      ? tasks.filter(task => task.status !== '已完成' && task.status !== '异常')
      : tasks.filter(task => task.status === '已完成' || task.status === '异常');

  const filtered = tabFiltered.filter((task) => {
    if (!keyword.trim()) return true;
    const value = keyword.trim();
    return task.merchantName.includes(value) || task.items.some(item => item.productName.includes(value));
  });

  const pendingGroups = groupPendingTasks(pendingTasks).map((group) => {
    const meta = PENDING_GROUPS.find(item => item.key === group.status);
    return {
      ...meta!,
      tasks: group.tasks,
    };
  });

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
          <span>总任务</span>
          <strong>{tasks.length}</strong>
        </div>

        <div className="mobile-hero__eyebrow">任务总览</div>
        <div className="mobile-hero__title">全部任务</div>
        <div className="mobile-hero__meta">
          <span>{selectedDate}</span>
          <span>待处理 {pendingCount} 单</span>
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
            <DatePicker
              value={dayjs(selectedDate)}
              onChange={(value) => setSelectedDate((value || dayjs()).format('YYYY-MM-DD'))}
              allowClear={false}
              style={{ width: '100%' }}
            />
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
        pendingGroups.length === 0 ? (
          <EmptyState title="待处理清空了" description="现在可以去看全部任务或继续录单" />
        ) : (
          <div className="mobile-pending-board">
            {pendingGroups.map((group, groupIndex) => {
              const Icon = group.icon;
              return (
                <section
                  key={group.key}
                  className="mobile-pending-group mobile-rise"
                  style={{ animationDelay: `${120 + groupIndex * 70}ms` }}
                >
                  <div className="mobile-pending-group__head">
                    <div className="mobile-pending-group__badge">
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="mobile-pending-group__title">{group.label}</div>
                      <div className="mobile-pending-group__desc">{group.desc}</div>
                    </div>
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
              );
            })}
          </div>
        )
      ) : filtered.length === 0 ? (
        <EmptyState title="没有任务" />
      ) : (
        filtered.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
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
          <div>
            <div className="mobile-sheet__title">新增任务</div>
            <div className="mobile-sheet__desc">批量导入先预览确认，手动补录直接保存</div>
          </div>
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
            <span>手动补录</span>
          </button>
        </div>

        {createLoading ? (
          <div className="mobile-sheet__loading">
            <Spin />
          </div>
        ) : entryMode === 'paste' ? (
          <div className="mobile-entry-panel">
            <div className="mobile-entry-tip">适合直接复制聊天记录，先生成预览，再人工确认导入</div>
            <div className="mobile-field-card__label">批量导入日期</div>
            <DatePicker
              value={dayjs(taskDate)}
              onChange={(value) => setTaskDate((value || dayjs().add(1, 'day')).format('YYYY-MM-DD'))}
              allowClear={false}
              style={{ width: '100%' }}
            />
            <div className="mobile-field-card__label">批量导入内容</div>
            <Input.TextArea
              rows={10}
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder={'可直接粘贴多行\n例如\n东桥 明天早上一盘\n刘记 明天送豆腐，黑豆腐少送，豆干3斤\n东桥超市：豆腐20斤，黑豆腐10斤'}
            />
          </div>
        ) : (
          <div className="mobile-entry-panel">
            <div className="mobile-entry-tip">适合临时补单，商户和商品都来自管理页的最新数据</div>
            <div className="mobile-field-card__label">录单日期</div>
            <DatePicker
              value={dayjs(taskDate)}
              onChange={(value) => setTaskDate((value || dayjs().add(1, 'day')).format('YYYY-MM-DD'))}
              allowClear={false}
              style={{ width: '100%' }}
            />
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

            <div className="mobile-field-card__label">预计配送时间</div>
            <Input value={routeEta} onChange={(event) => setRouteEta(event.target.value)} placeholder="预计配送时间 如 07:30" />

            <div className="mobile-entry-lines">
              {manualPreview.map((line) => (
                <div key={line.id} className="mobile-entry-line">
                  <Select
                    value={line.productId || undefined}
                    onChange={(value) => handleManualProductChange(line.id, value)}
                    options={products.map(item => ({ value: item.id, label: item.name }))}
                    placeholder="选择商品"
                    size="large"
                  />
                  <Select
                    value={line.specId || undefined}
                    onChange={(value) => handleManualSpecChange(line.id, value)}
                    options={(line.product?.specs || []).map(item => ({ value: item.id, label: item.label }))}
                    placeholder="选择规格"
                    size="large"
                  />
                  <div className="mobile-entry-line__foot">
                    <InputNumber
                      min={0.5}
                      step={0.5}
                      value={line.plannedWeight}
                      onChange={(value) => handleManualWeightChange(line.id, Number(value || 0))}
                      addonAfter="斤"
                    />
                    <button type="button" className="mobile-inline-action" onClick={() => handleRemoveManualLine(line.id)}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="mobile-inline-action mobile-inline-action--full" onClick={handleAddManualLine}>
              + 继续添加商品
            </button>

            <div className="mobile-entry-total">
              <span>总重量</span>
              <strong>{manualTotalWeight.toFixed(1)} 斤</strong>
            </div>
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
        height="82vh"
        rootClassName="mobile-sheet"
        closeIcon={null}
      >
        <div className="mobile-sheet__head">
          <div>
            <div className="mobile-sheet__title">导入预览</div>
            <div className="mobile-sheet__desc">确认商户、规格和重量都对，再真正新增任务</div>
          </div>
          <button type="button" className="mobile-sheet__close" onClick={() => setPreviewOpen(false)}>
            关闭
          </button>
        </div>

        <div className="mobile-record-stack">
          {previewTasks.map((task) => (
            <div key={`${task.merchantId}_${task.merchantName}`} className="mobile-record-card">
              <div className="mobile-record-card__head">
                <div>
                  <div className="mobile-record-card__title">{task.merchantName}</div>
                  <div className="mobile-record-card__meta">
                    <span>{task.phone || '无电话'}</span>
                    <span>{task.settlementDay || '未设置结算日'}</span>
                  </div>
                </div>
                <div className="mobile-record-card__stat">
                  <span>总重量</span>
                  <strong>{task.plannedWeight}</strong>
                </div>
              </div>

              <div className="mobile-record-card__rows">
                {task.items.map((item) => (
                  <div key={`${task.merchantId}_${item.productId}_${item.specId}`} className="mobile-record-card__row">
                    <div>
                      <div>{item.productName}</div>
                      <div className="mobile-record-card__dim">{item.specLabel}</div>
                    </div>
                    <strong>{item.plannedWeight} 斤</strong>
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

        <div className="mobile-sheet__actions">
          <Button onClick={() => setPreviewOpen(false)} size="large">
            返回修改
          </Button>
          <Button type="primary" size="large" loading={submitLoading} onClick={handleConfirmPreview}>
            确认新增
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
