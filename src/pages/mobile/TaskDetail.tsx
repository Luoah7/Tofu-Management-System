import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, InputNumber, Modal, Spin, message } from 'antd';
import { ImageViewer } from 'antd-mobile';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ImageUp,
  MapPin,
  Minus,
  Phone,
  Plus,
  Scale,
  Truck,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { SectionHeading, StatusBadge } from '@/components/mobile/shared';
import { formatTaskItemMeasure, type TaskItemUnit } from '@/shared/task-item';
import { formatMoney, formatWeight } from '@/utils/format';

type TaskItem = {
  id: string;
  productName: string;
  specLabel: string;
  unitPrice: number;
  displayAmount?: number;
  displayUnit?: TaskItemUnit;
  plannedWeight: number;
  actualWeight: number;
};

type TaskPhoto = {
  id: string;
  stage?: string;
  url: string;
  originalName: string;
};

type RecognizedWeight = {
  weight: number;
  unit: '斤' | '公斤';
  rawText: string;
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
  photos?: TaskPhoto[];
};

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [weighValues, setWeighValues] = useState<Record<string, number>>({});
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [deliveryPhotos, setDeliveryPhotos] = useState<File[]>([]);
  const [sentBasket, setSentBasket] = useState(0);
  const [returnedBasket, setReturnedBasket] = useState(0);
  const [exceptionModal, setExceptionModal] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [recognizingWeight, setRecognizingWeight] = useState(false);
  const [recognizedWeight, setRecognizedWeight] = useState<RecognizedWeight | null>(null);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  const albumInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const weighPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const deliveryAlbumInputRef = useRef<HTMLInputElement | null>(null);
  const deliveryCameraInputRef = useRef<HTMLInputElement | null>(null);

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
        setSelectedPhotos([]);
        setDeliveryPhotos([]);
        setRecognizedWeight(null);
        setSentBasket(currentTask.sentBasketCount);
        setReturnedBasket(currentTask.returnedBasketCount);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  const photoPreviews = useMemo(
    () => selectedPhotos.map(file => ({
      name: file.name,
      url: URL.createObjectURL(file),
    })),
    [selectedPhotos],
  );

  const deliveryPhotoPreviews = useMemo(
    () => deliveryPhotos.map(file => ({
      name: file.name,
      url: URL.createObjectURL(file),
    })),
    [deliveryPhotos],
  );

  useEffect(() => () => {
    photoPreviews.forEach(photo => URL.revokeObjectURL(photo.url));
  }, [photoPreviews]);

  useEffect(() => () => {
    deliveryPhotoPreviews.forEach(photo => URL.revokeObjectURL(photo.url));
  }, [deliveryPhotoPreviews]);

  const totalWeigh = useMemo(() => {
    if (!task) return 0;
    return task.items.reduce((sum, item) => sum + Number(weighValues[item.id] || 0), 0);
  }, [task, weighValues]);

  const updateWeighValue = (itemId: string, value: number) => {
    setWeighValues(prev => ({
      ...prev,
      [itemId]: Math.max(0, Number(value.toFixed(1))),
    }));
  };

  const stepWeighValue = (itemId: string, delta: number) => {
    updateWeighValue(itemId, Number(weighValues[itemId] || 0) + delta);
  };

  const handleWeigh = async () => {
    if (!task) return;
    if (selectedPhotos.length === 0) {
      message.warning('称完要把照片一起传上来');
      return;
    }

    setActionLoading(true);
    try {
      const items = task.items.map(item => ({
        id: item.id,
        actualWeight: weighValues[item.id] || item.plannedWeight,
      }));
      const formData = new FormData();
      formData.append('actualWeight', String(totalWeigh));
      formData.append('items', JSON.stringify(items));
      selectedPhotos.forEach(photo => formData.append('photos', photo));
      await api.putForm(`/tasks/${task.id}/weigh`, formData);
      message.success('复秤和拍照已完成');
      load();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecognizeWeight = async (file: File | null) => {
    if (!task || !file) return;

    setRecognizingWeight(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const result = await api.postForm<RecognizedWeight>(`/tasks/${task.id}/weigh/recognize`, formData);
      setRecognizedWeight(result);
      if (task.items.length === 1) {
        updateWeighValue(task.items[0].id, result.weight);
      }
      message.success(`已识别 ${result.weight}斤`);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setRecognizingWeight(false);
    }
  };

  const appendPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const nextPhotos = Array.from(files).filter(file => file.type.startsWith('image/'));
    setSelectedPhotos(prev => [...prev, ...nextPhotos]);
  };

  const removePhoto = (index: number) => {
    setSelectedPhotos(prev => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const appendDeliveryPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const nextPhotos = Array.from(files).filter(file => file.type.startsWith('image/'));
    setDeliveryPhotos(prev => [...prev, ...nextPhotos]);
  };

  const removeDeliveryPhoto = (index: number) => {
    setDeliveryPhotos(prev => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleComplete = async () => {
    if (!task) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('signMethod', '现场确认');
      deliveryPhotos.forEach(photo => formData.append('photos', photo));
      await api.putForm(`/tasks/${task.id}/complete`, formData);
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
      await api.put(`/tasks/${task.id}/exception`, { exceptionReason, exceptionNote: '' });
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

  const totalDelta = totalWeigh - task.plannedWeight;
  const formatItemMeasure = (item: TaskItem) => (
    item.displayAmount && item.displayAmount > 0
      ? formatTaskItemMeasure(item.displayAmount, item.displayUnit)
      : formatWeight(item.plannedWeight)
  );
  const deltaText = totalDelta === 0
    ? '与应配一致'
    : totalDelta > 0
      ? `多 ${formatWeight(totalDelta)}`
      : `少 ${formatWeight(Math.abs(totalDelta))}`;
  const isWeighStage = task.status === '待复秤' || task.status === '待配货';
  const isDeliveryStage = task.status === '待送达';
  const archivedPhotoUrls = task.photos?.map(photo => photo.url) || [];

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
          {task.status === '已完成' && task.completedAt ? <span className="mobile-chip mobile-chip--dark">{task.completedAt}</span> : null}
          {task.phone ? (
            <span className="mobile-chip mobile-chip--dark">
              <Phone size={14} />
              <span>{task.phone}</span>
            </span>
          ) : null}
        </div>
      </section>

      {isWeighStage ? (
        <div className="mobile-action-focus mobile-rise" style={{ animationDelay: '60ms' }}>
          <div className="mobile-action-focus__head">
            <div className="mobile-action-focus__badge">
              <Scale size={18} />
            </div>
            <div>
              <div className="mobile-action-focus__title">复秤录入</div>
            </div>
          </div>

          <div className="mobile-surface mobile-surface--padded" style={{ marginTop: 14 }}>
            <input
              ref={weighPhotoInputRef}
              className="mobile-hidden-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                handleRecognizeWeight(file);
                event.target.value = '';
              }}
            />

            <div className="mobile-photo-actions" style={{ marginBottom: 14 }}>
              <Button
                block
                className="mobile-ghost-button"
                icon={<ImageUp size={16} />}
                loading={recognizingWeight}
                onClick={() => weighPhotoInputRef.current?.click()}
              >
                拍照识别重量
              </Button>
            </div>

            <div className="mobile-input-grid">
              {task.items.map(item => (
                <div key={item.id} className="mobile-input-row">
                  <div>
                    <div className="mobile-input-row__label">{item.productName}</div>
                    <div className="mobile-input-row__hint">应配 {formatItemMeasure(item)}</div>
                  </div>
                  <div className="mobile-stepper mobile-stepper--weight">
                    <button
                      type="button"
                      onClick={() => stepWeighValue(item.id, -0.1)}
                      aria-label="减少"
                    >
                      <Minus size={15} />
                    </button>
                    <InputNumber
                      controls={false}
                      min={0}
                      step={0.1}
                      precision={1}
                      value={weighValues[item.id]}
                      onChange={value => updateWeighValue(item.id, Number(value || 0))}
                    />
                    <button
                      type="button"
                      onClick={() => stepWeighValue(item.id, 0.1)}
                      aria-label="增加"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mobile-field-card" style={{ marginTop: 14 }}>
              <div className="mobile-field-card__label">总重量</div>
              <div className="mobile-auto-total">
                {formatWeight(totalWeigh)}
              </div>
              <div className="mobile-panel-note">
                <span>应配 {formatWeight(task.plannedWeight)}</span>
                <span>{deltaText}</span>
              </div>
              {recognizedWeight ? (
                <div className="mobile-recognition-note">
                  已识别 {formatWeight(recognizedWeight.weight)}
                </div>
              ) : null}
            </div>

            <div className="mobile-field-card" style={{ marginTop: 14 }}>
              <div className="mobile-field-card__label">留档照片</div>
              <div className="mobile-photo-actions">
                <input
                  ref={albumInputRef}
                  className="mobile-hidden-input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    appendPhotos(event.target.files);
                    event.target.value = '';
                  }}
                />
                <input
                  ref={cameraInputRef}
                  className="mobile-hidden-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    appendPhotos(event.target.files);
                    event.target.value = '';
                  }}
                />
                <Button block className="mobile-ghost-button" onClick={() => albumInputRef.current?.click()}>
                  选相册
                </Button>
                <Button block className="mobile-ghost-button" onClick={() => cameraInputRef.current?.click()}>
                  打开相机
                </Button>
              </div>
              <div className="mobile-panel-note">
                <span>待上传 {selectedPhotos.length} 张</span>
                <span>已存档 {task.photos?.length || 0} 张</span>
              </div>
            </div>

            {photoPreviews.length > 0 ? (
              <div className="mobile-photo-grid">
                {photoPreviews.map((photo, index) => (
                  <div key={`${photo.name}_${index}`} className="mobile-photo-card">
                    <img src={photo.url} alt={photo.name} className="mobile-photo-card__image" />
                    <button type="button" className="mobile-photo-card__remove" onClick={() => removePhoto(index)}>
                      删除
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <Button
              type="primary"
              block
              className="mobile-primary-button"
              style={{ marginTop: 14 }}
              icon={<Camera size={16} />}
              loading={actionLoading}
              onClick={handleWeigh}
            >
              确认复秤并留档
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
              <div className="mobile-action-focus__title">确认送达</div>
            </div>
          </div>

          <div className="mobile-surface mobile-surface--padded" style={{ marginTop: 14 }}>
            <div className="mobile-field-card">
              <div className="mobile-field-card__label">送达留档照片</div>
              <div className="mobile-photo-actions">
                <input
                  ref={deliveryAlbumInputRef}
                  className="mobile-hidden-input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    appendDeliveryPhotos(event.target.files);
                    event.target.value = '';
                  }}
                />
                <input
                  ref={deliveryCameraInputRef}
                  className="mobile-hidden-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    appendDeliveryPhotos(event.target.files);
                    event.target.value = '';
                  }}
                />
                <Button block className="mobile-ghost-button" onClick={() => deliveryAlbumInputRef.current?.click()}>
                  选相册
                </Button>
                <Button block className="mobile-ghost-button" onClick={() => deliveryCameraInputRef.current?.click()}>
                  打开相机
                </Button>
              </div>
              <div className="mobile-panel-note">
                <span>待上传 {deliveryPhotos.length} 张</span>
                <span>已存档 {task.photos?.length || 0} 张</span>
              </div>
            </div>

            {deliveryPhotoPreviews.length > 0 ? (
              <div className="mobile-photo-grid">
                {deliveryPhotoPreviews.map((photo, index) => (
                  <div key={`${photo.name}_${index}`} className="mobile-photo-card">
                    <img src={photo.url} alt={photo.name} className="mobile-photo-card__image" />
                    <button type="button" className="mobile-photo-card__remove" onClick={() => removeDeliveryPhoto(index)}>
                      删除
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

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

            <div className="mobile-field-card" style={{ marginTop: 14 }}>
              <div className="mobile-field-card__label">筐子记录</div>
              <div className="mobile-dual-grid">
                <div>
                  <div className="mobile-field-card__label">送出</div>
                  <div className="mobile-number-input mobile-number-input--wide">
                    <InputNumber
                      min={0}
                      value={sentBasket}
                      onChange={value => setSentBasket(Number(value || 0))}
                    />
                  </div>
                </div>
                <div>
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
                <span>当前持筐</span>
                <span>{task.beforeBasketCount} 个</span>
              </div>
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

      <SectionHeading title="商品" extra={`${task.items.length} 项`} />

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
                <strong>{formatItemMeasure(item)}</strong>
                <span>{formatMoney(item.plannedWeight * item.unitPrice)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

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
          />
        </div>
      </Modal>

      {task.photos?.length ? (
        <>
          <SectionHeading title="照片" extra={`${task.photos.length} 张`} />
          <div className="mobile-photo-grid mobile-rise" style={{ animationDelay: '280ms' }}>
            {task.photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                className="mobile-photo-card mobile-photo-card--button"
                onClick={() => {
                  setPhotoViewerIndex(index);
                  setPhotoViewerOpen(true);
                }}
              >
                <img src={photo.url} alt={photo.originalName} className="mobile-photo-card__image" />
                <span className="mobile-photo-card__stage">{photo.stage || '留档'}</span>
              </button>
            ))}
          </div>
          <ImageViewer.Multi
            images={archivedPhotoUrls}
            visible={photoViewerOpen}
            defaultIndex={photoViewerIndex}
            onClose={() => setPhotoViewerOpen(false)}
          />
        </>
      ) : null}
    </div>
  );
}
