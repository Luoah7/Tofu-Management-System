import React, { useEffect, useState } from 'react';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Spin,
  message,
} from 'antd';
import {
  ChevronLeft,
  History,
  MapPin,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  Store,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { EmptyState, SectionHeading } from '@/components/mobile/shared';
import { formatMoney } from '@/utils/format';

type HistoryItem = {
  productName: string;
  specLabel: string;
  weight: number;
  unitPrice: number;
  subtotal: number;
};

type HistoryRecord = {
  id: string;
  taskDate: string;
  status: string;
  plannedWeight: number;
  actualWeight: number;
  operator: string;
  items: HistoryItem[];
};

type Merchant = {
  id: string;
  name: string;
  type: string;
  contactName: string;
  phone: string;
  address: string;
  settlementDay: string;
  discountRate: number;
  basketCount: number;
  status: string;
  note?: string;
  deliveryHistory?: HistoryRecord[];
};

const MERCHANT_TYPE_OPTIONS = [
  { value: '超市', label: '超市' },
  { value: '小商贩', label: '小商贩' },
  { value: '散户', label: '散户' },
  { value: '其他', label: '其他' },
];

export default function MobileMerchants() {
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Merchant | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyMerchant, setHistoryMerchant] = useState<Merchant | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    api.get<Merchant[]>('/merchants').then(setMerchants).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      type: '超市',
      discountRate: 1,
      basketCount: 0,
    });
    setModalOpen(true);
  };

  const openEdit = (merchant: Merchant) => {
    setEditing(merchant);
    form.setFieldsValue(merchant);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/merchants/${editing.id}`, values);
        message.success('商户已更新');
      } else {
        await api.post('/merchants', values);
        message.success('商户已新增');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      load();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleToggle = async (merchant: Merchant) => {
    try {
      await api.put(`/merchants/${merchant.id}`, {
        status: merchant.status === '启用' ? '停用' : '启用',
      });
      message.success(merchant.status === '启用' ? '商户已停用' : '商户已启用');
      load();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleShowHistory = async (merchant: Merchant) => {
    setHistoryLoading(true);
    setHistoryOpen(true);
    try {
      const detail = await api.get<Merchant>(`/merchants/${merchant.id}`);
      setHistoryMerchant(detail);
    } catch {
      setHistoryMerchant(merchant);
    } finally {
      setHistoryLoading(false);
    }
  };

  const activeCount = merchants.filter(item => item.status === '启用').length;

  return (
    <div className="mobile-page">
      <section className="mobile-hero mobile-rise">
        <button type="button" className="mobile-back-button" onClick={() => navigate('/mobile/manage')}>
          <ChevronLeft size={18} />
        </button>
        <div className="mobile-hero__eyebrow" style={{ marginTop: 14 }}>移动端管理</div>
        <div className="mobile-hero__title">商户管理</div>
        <div className="mobile-hero__meta">
          <span>共 {merchants.length} 家</span>
          <span>启用 {activeCount} 家</span>
        </div>
        <div className="mobile-inline-chips">
          <span className="mobile-chip mobile-chip--light">新增 编辑 历史 都在这里</span>
        </div>
      </section>

      <div className="mobile-toolbar mobile-rise" style={{ animationDelay: '80ms' }}>
        <Button
          type="primary"
          className="mobile-primary-button"
          icon={<Plus size={16} />}
          onClick={openCreate}
        >
          新增商户
        </Button>
      </div>

      <SectionHeading eyebrow="商户列表" title="常用商户" extra={`${merchants.length} 家`} />

      {loading ? (
        <div className="mobile-loading">
          <Spin size="large" />
        </div>
      ) : merchants.length === 0 ? (
        <EmptyState title="还没有商户" description="先建一个，后面配货和结算才有对象。" />
      ) : (
        <div className="mobile-record-stack">
          {merchants.map((merchant, index) => (
            <div
              key={merchant.id}
              className="mobile-record-card mobile-rise"
              style={{ animationDelay: `${110 + index * 50}ms` }}
            >
              <div className="mobile-record-card__head">
                <div>
                  <div className="mobile-record-card__title">{merchant.name}</div>
                  <div className="mobile-record-card__meta">
                    <Store size={14} />
                    <span>{merchant.type}</span>
                    <span className={`status-badge ${merchant.status === '启用' ? 'status-badge--green' : 'status-badge--red'}`}>
                      {merchant.status}
                    </span>
                  </div>
                </div>
                <div className="mobile-record-card__stat">
                  <span>持筐</span>
                  <strong>{merchant.basketCount}</strong>
                </div>
              </div>

              <div className="mobile-record-card__rows">
                {merchant.contactName || merchant.phone ? (
                  <div className="mobile-record-card__row">
                    <span>{merchant.contactName || '联系人未填'}</span>
                    {merchant.phone ? (
                      <span className="mobile-record-card__dim">
                        <Phone size={14} />
                        {merchant.phone}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="mobile-record-card__row">
                  <span className="mobile-record-card__dim">
                    <MapPin size={14} />
                    {merchant.address || '地址未填'}
                  </span>
                </div>

                <div className="mobile-record-card__row">
                  <span>结算日 {merchant.settlementDay || '-'}</span>
                  <span>折扣 {merchant.discountRate === 1 ? '不打折' : `${merchant.discountRate * 10}折`}</span>
                </div>
              </div>

              <div className="mobile-record-card__actions">
                <button type="button" className="mobile-inline-action" onClick={() => openEdit(merchant)}>
                  <Pencil size={15} />
                  编辑
                </button>
                <button type="button" className="mobile-inline-action" onClick={() => handleShowHistory(merchant)}>
                  <History size={15} />
                  历史
                </button>
                <button type="button" className="mobile-inline-action" onClick={() => handleToggle(merchant)}>
                  <PackageCheck size={15} />
                  {merchant.status === '启用' ? '停用' : '启用'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        title={editing ? '编辑商户' : '新增商户'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        rootClassName="mobile-dialog"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="商户名称" rules={[{ required: true, message: '请输入商户名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型">
            <Select options={MERCHANT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="contactName" label="联系人">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input />
          </Form.Item>
          <Form.Item name="settlementDay" label="结算日">
            <Input placeholder="如 每月5日" />
          </Form.Item>
          <Form.Item name="discountRate" label="折扣率">
            <InputNumber style={{ width: '100%' }} min={0} max={1} step={0.05} />
          </Form.Item>
          <Form.Item name="basketCount" label="当前持有筐数">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={historyMerchant ? `${historyMerchant.name} 的配货历史` : '配货历史'}
        open={historyOpen}
        footer={null}
        onCancel={() => {
          setHistoryOpen(false);
          setHistoryMerchant(null);
        }}
        rootClassName="mobile-dialog"
      >
        {historyLoading ? (
          <div className="mobile-loading">
            <Spin size="large" />
          </div>
        ) : !historyMerchant?.deliveryHistory?.length ? (
          <EmptyState title="还没有历史记录" description="这家商户目前还没有已完成的配货任务。" />
        ) : (
          <div className="mobile-record-stack">
            {historyMerchant.deliveryHistory.map(record => (
              <div key={record.id} className="mobile-record-card">
                <div className="mobile-record-card__head">
                  <div>
                    <div className="mobile-record-card__title">{record.taskDate}</div>
                    <div className="mobile-record-card__meta">
                      <span>{record.operator || '未记录操作员'}</span>
                    </div>
                  </div>
                  <div className="mobile-record-card__stat">
                    <span>实秤</span>
                    <strong>{record.actualWeight > 0 ? `${record.actualWeight}斤` : '-'}</strong>
                  </div>
                </div>
                <div className="mobile-record-card__rows">
                  <div className="mobile-record-card__row">
                    <span>{record.items.map(item => `${item.productName} ${item.weight}斤`).join('、')}</span>
                  </div>
                  <div className="mobile-record-card__row">
                    <span>应配 {record.plannedWeight}斤</span>
                    <span>
                      金额 {formatMoney(record.items.reduce((sum, item) => sum + item.subtotal, 0))}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
