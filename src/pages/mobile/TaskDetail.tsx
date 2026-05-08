import React, { useEffect, useState } from 'react';
import { Button, Input, InputNumber, Modal, Spin, message } from 'antd';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  MapPin,
  Phone,
  Scale,
  Truck,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { SectionHeading, StatusBadge } from '@/components/mobile/shared';
import { formatMoney, formatWeight } from '@/utils/format';

type TaskItem = {
  id: string;
  productName: string;
  specLabel: string;
  unitPrice: number;
  plannedWeight: number;
  actualWeight: number;
};

type Task = {
  id: string;
  merchantName: string;
  merchantType: string;
  address: string;
  phone: string;
  status: string;
  plannedWeight: number;
  actualWeight: number;
  photoCount: number;
  beforeBasketCount: number;
  sentBasketCount: number;
  returnedBasketCount: number;
  signMethod: string;
  operator: string;
  note: string;
  exceptionReason: string;
  exceptionNote: string;
  completedAt: string;
  routeEta: string;
  items: TaskItem[];
};

const NORMAL_FLOW = ['待配货', '待复秤', '待拍照', '待送达', '已完成'];

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [weighValues, setWeighValues] = useState<Record<string, number>>({});
  const [totalWeigh, setTotalWeigh] = useState<number>(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [sentBasket, setSentBasket] = useState(0);
  const [returnedBasket, setReturnedBasket] = useState(0);
  const [exceptionModal, setExceptionModal] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');
  const [exceptionNote, setExceptionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    api.get<Task>(`/tasks/${id}`)
      .then(currentTask => {
        setTask(currentTask);

        const nextWeighValues: Record<string, number> = {};
        currentTask.items.forEach(item => {
          nextWeighValues[item.id] = item.actualWeight > 0 ? item.actualWeight : item.plannedWeight;
        });

        setWeighValues(nextWeighValues);
        setTotalWeigh(currentTask.actualWeight > 0 ? currentTask.actualWeight : currentTask.plannedWeight);
        setPhotoCount(currentTask.photoCount);
        setSentBasket(currentTask.sentBasketCount);
        setReturnedBasket(currentTask.returnedBasketCount);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleWeigh = async () => {
    if (!task) return;
    setActionLoading(true);
    try {
      const items = task.items.map(item => ({
        id: item.id,
        actualWeight: weighValues[item.id] || item.plannedWeight,
      }));
      await api.put(`/tasks/${task.id}/weigh`, { actualWeight: totalWeigh, items });
      message.success('复秤完成');
      load();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePhoto = async () => {
    if (!task) return;
    setActionLoading(true);
    try {
      await api.put(`/tasks/${task.id}/photo`, { photoCount });
      message.success('拍照记录已保存');
      load();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!task) return;
    setActionLoading(true);
    try {
      await api.put(`/tasks/${task.id}/complete`, { signMethod: '现场确认' });
      if (sentBasket > 0 || returnedBasket > 0) {
        await api.put(`/tasks/${task.id}/basket`, {
          sentBasketCount: sentBasket,
          returnedBasketCount: returnedBasket,
        });
      }
      message.success('任务已完成');
      navigate('/mobile/tasks');
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleException = async () => {
    if (!task || !exceptionReason) return;
    setActionLoading(true);
    try {
      await api.put(`/tasks/${task.id}/exception`, { exceptionReason, exceptionNote });
      message.success('异常已记录');
      setExceptionModal(false);
      load();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mobile-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="mobile-page">
        <div className="mobile-empty">任务不存在</div>
      </div>
    );
  }

  const currentStep = task.status === '异常'
    ? 3
    : Math.max(0, NORMAL_FLOW.indexOf(task.status));
  const totalDelta = totalWeigh - task.plannedWeight;
  const deltaText = totalDelta === 0
    ? '与应配一致'
    : totalDelta > 0
      ? `多 ${formatWeight(totalDelta)}`
      : `少 ${formatWeight(Math.abs(totalDelta))}`;
  const isWeighStage = task.status === '待复秤' || task.status === '待配货';
  const isPhotoStage = task.status === '待拍照';
  const isDeliveryStage = task.status === '待送达';

  return (
    <div className="mobile-page">
      <section className="mobile-hero mobile-hero--detail mobile-rise">
        <button type="button" className="mobile-back-button" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </button>

        <div className="mobile-hero__eyebrow" style={{ marginTop: 14 }}>任务详情</div>
        <div className="mobile-hero__title">{task.merchantName}</div>
        <div className="mobile-hero__meta">
          <MapPin size={14} />
          <span>{task.address}</span>
        </div>
        <div className="mobile-inline-chips">
          <StatusBadge status={task.status} />
          <span className="mobile-chip mobile-chip--dark">{task.merchantType || '商户'}</span>
          <span className="mobile-chip mobile-chip--dark">预计 {task.routeEta || '待安排'}</span>
          {task.phone ? (
            <span className="mobile-chip mobile-chip--dark">
              <Phone size={14} />
              <span>{task.phone}</span>
            </span>
          ) : null}
        </div>
        <div className="mobile-detail-progress">
          当前流程走到第 {currentStep + 1} 步
          <span>{task.status}</span>
        </div>
      </section>

      {isWeighStage ? (
        <div className="mobile-action-focus mobile-rise" style={{ animationDelay: '60ms' }}>
          <div className="mobile-action-focus__head">
            <div className="mobile-action-focus__badge">
              <Scale size={18} />
            </div>
            <div>
              <div className="mobile-action-focus__eyebrow">现在要做</div>
              <div className="mobile-action-focus__title">复秤录入</div>
              <div className="mobile-action-focus__desc">先改每个品项实秤，再确认总重量。</div>
            </div>
          </div>

          <div className="mobile-surface mobile-surface--padded" style={{ marginTop: 14 }}>
            <div className="mobile-input-grid">
              {task.items.map(item => (
                <div key={item.id} className="mobile-input-row">
                  <div>
                    <div className="mobile-input-row__label">{item.productName}</div>
                    <div className="mobile-input-row__hint">应配 {formatWeight(item.plannedWeight)}</div>
                  </div>
                  <div className="mobile-number-input">
                    <InputNumber
                      min={0}
                      step={0.1}
                      precision={1}
                      value={weighValues[item.id]}
                      onChange={value => setWeighValues(prev => ({ ...prev, [item.id]: Number(value || 0) }))}
                      addonAfter="斤"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mobile-field-card" style={{ marginTop: 14 }}>
              <div className="mobile-field-card__label">总重量</div>
              <div className="mobile-number-input mobile-number-input--wide">
                <InputNumber
                  min={0}
                  step={0.1}
                  precision={1}
                  value={totalWeigh}
                  onChange={value => setTotalWeigh(Number(value || 0))}
                  addonAfter="斤"
                />
              </div>
              <div className="mobile-panel-note">
                <span>应配 {formatWeight(task.plannedWeight)}</span>
                <span>{deltaText}</span>
              </div>
            </div>

            <Button
              type="primary"
              block
              className="mobile-primary-button"
              style={{ marginTop: 14 }}
              icon={<Scale size={16} />}
              loading={actionLoading}
              onClick={handleWeigh}
            >
              确认复秤
            </Button>
          </div>
        </div>
      ) : null}

      {isPhotoStage ? (
        <div className="mobile-action-focus mobile-rise" style={{ animationDelay: '60ms' }}>
          <div className="mobile-action-focus__head">
            <div className="mobile-action-focus__badge">
              <Camera size={18} />
            </div>
            <div>
              <div className="mobile-action-focus__eyebrow">现在要做</div>
              <div className="mobile-action-focus__title">拍照记录</div>
              <div className="mobile-action-focus__desc">先补现场照片数量，保存后就能继续下一步。</div>
            </div>
          </div>

          <div className="mobile-surface mobile-surface--padded" style={{ marginTop: 14 }}>
            <div className="mobile-field-card">
              <div className="mobile-field-card__label">现场照片数量</div>
              <div className="mobile-number-input mobile-number-input--wide">
                <InputNumber
                  min={0}
                  value={photoCount}
                  onChange={value => setPhotoCount(Number(value || 0))}
                  addonAfter="张"
                />
              </div>
            </div>
            <Button
              type="primary"
              block
              className="mobile-primary-button"
              style={{ marginTop: 14 }}
              icon={<Camera size={16} />}
              loading={actionLoading}
              onClick={handlePhoto}
            >
              确认拍照
            </Button>
          </div>
        </div>
      ) : null}

      {isDeliveryStage ? (
        <div className="mobile-action-focus mobile-rise" style={{ animationDelay: '60ms' }}>
          <div className="mobile-action-focus__head">
            <div className="mobile-action-focus__badge">
              <Truck size={18} />
            </div>
            <div>
              <div className="mobile-action-focus__eyebrow">现在要做</div>
              <div className="mobile-action-focus__title">确认送达</div>
              <div className="mobile-action-focus__desc">先补筐子交接，再确认签收。异常也在这里记。</div>
            </div>
          </div>

          <div className="mobile-surface mobile-surface--padded" style={{ marginTop: 14 }}>
            <div className="mobile-dual-grid">
              <div className="mobile-field-card">
                <div className="mobile-field-card__label">送出</div>
                <div className="mobile-number-input mobile-number-input--wide">
                  <InputNumber
                    min={0}
                    value={sentBasket}
                    onChange={value => setSentBasket(Number(value || 0))}
                  />
                </div>
              </div>
              <div className="mobile-field-card">
                <div className="mobile-field-card__label">回收</div>
                <div className="mobile-number-input mobile-number-input--wide">
                  <InputNumber
                    min={0}
                    value={returnedBasket}
                    onChange={value => setReturnedBasket(Number(value || 0))}
                  />
                </div>
              </div>
            </div>

            <div className="mobile-panel-note">
              <span>商户当前持有</span>
              <span>{task.beforeBasketCount} 个筐</span>
            </div>

            <div className="mobile-sticky-actions mobile-sticky-actions--inline">
              <Button
                block
                className="mobile-ghost-button"
                onClick={() => setExceptionModal(true)}
              >
                记录异常
              </Button>
              <Button
                type="primary"
                block
                className="mobile-primary-button"
                icon={<Truck size={16} />}
                loading={actionLoading}
                onClick={handleComplete}
              >
                确认送达
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {task.status === '已完成' ? (
        <div className="mobile-note-card mobile-note-card--success mobile-rise" style={{ animationDelay: '60ms' }}>
          <div className="mobile-note-card__title">
            <CheckCircle2 size={18} />
            <span>任务已完成</span>
          </div>
          <div className="mobile-note-card__content">
            完成时间 {task.completedAt || '-'}
            <br />
            实秤重量 {formatWeight(task.actualWeight)}
            <br />
            签收方式 {task.signMethod || '-'}
          </div>
        </div>
      ) : null}

      {task.status === '异常' ? (
        <div className="mobile-note-card mobile-note-card--danger mobile-rise" style={{ animationDelay: '60ms' }}>
          <div className="mobile-note-card__title">
            <AlertTriangle size={18} />
            <span>异常任务</span>
          </div>
          <div className="mobile-note-card__content">
            原因 {task.exceptionReason || '-'}
            <br />
            备注 {task.exceptionNote || '-'}
          </div>
        </div>
      ) : null}

      <div className="mobile-detail-grid">
        <div className="mobile-kpi mobile-rise" style={{ animationDelay: '100ms' }}>
          <div className="mobile-kpi__label">应配</div>
          <div className="mobile-kpi__value">{formatWeight(task.plannedWeight)}</div>
        </div>
        <div className="mobile-kpi mobile-rise" style={{ animationDelay: '150ms' }}>
          <div className="mobile-kpi__label">实秤</div>
          <div className="mobile-kpi__value">
            {task.actualWeight > 0 ? formatWeight(task.actualWeight) : '待录入'}
          </div>
        </div>
        <div className="mobile-kpi mobile-rise" style={{ animationDelay: '200ms' }}>
          <div className="mobile-kpi__label">筐子</div>
          <div className="mobile-kpi__value">{task.beforeBasketCount} 个</div>
        </div>
      </div>

      <SectionHeading eyebrow="配货明细" title="商品列表" extra={`${task.items.length} 项`} />

      <div className="mobile-surface mobile-surface--padded mobile-rise" style={{ animationDelay: '240ms' }}>
        <div className="mobile-info-list">
          {task.items.map(item => (
            <div key={item.id} className="mobile-info-row">
              <div>
                <div className="mobile-info-row__title">{item.productName}</div>
                <div className="mobile-info-row__meta">
                  {item.specLabel}
                  {item.actualWeight > 0 ? ` · 实秤 ${formatWeight(item.actualWeight)}` : ''}
                </div>
              </div>
              <div className="mobile-info-row__value">
                <strong>{formatWeight(item.plannedWeight)}</strong>
                <span>{formatMoney(item.plannedWeight * item.unitPrice)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {(task.status === '待送达' || task.status === '待拍照') && !isDeliveryStage ? (
        <>
          <SectionHeading eyebrow="补充信息" title="筐子管理" />

          <div className="mobile-surface mobile-surface--padded mobile-rise" style={{ animationDelay: '320ms' }}>
            <div className="mobile-dual-grid">
              <div className="mobile-field-card">
                <div className="mobile-field-card__label">送出</div>
                <div className="mobile-number-input mobile-number-input--wide">
                  <InputNumber
                    min={0}
                    value={sentBasket}
                    onChange={value => setSentBasket(Number(value || 0))}
                  />
                </div>
              </div>
              <div className="mobile-field-card">
                <div className="mobile-field-card__label">回收</div>
                <div className="mobile-number-input mobile-number-input--wide">
                  <InputNumber
                    min={0}
                    value={returnedBasket}
                    onChange={value => setReturnedBasket(Number(value || 0))}
                  />
                </div>
              </div>
            </div>

            <div className="mobile-panel-note">
              <span>商户当前持有</span>
              <span>{task.beforeBasketCount} 个筐</span>
            </div>
          </div>
        </>
      ) : null}

      <Modal
        title="记录异常"
        open={exceptionModal}
        onOk={handleException}
        onCancel={() => setExceptionModal(false)}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        rootClassName="mobile-dialog"
      >
        <div className="mobile-text-input" style={{ marginBottom: 14 }}>
          <div className="mobile-field-card__label">异常原因</div>
          <Input
            value={exceptionReason}
            onChange={event => setExceptionReason(event.target.value)}
            placeholder="如 缺货 临时改量 商户拒收"
          />
        </div>
        <div className="mobile-textarea">
          <div className="mobile-field-card__label">备注</div>
          <Input.TextArea
            rows={4}
            value={exceptionNote}
            onChange={event => setExceptionNote(event.target.value)}
            placeholder="补充说明"
          />
        </div>
      </Modal>
    </div>
  );
}
