import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Descriptions } from 'antd';
import { PlusOutlined, EditOutlined, StopOutlined, PlayCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import { api } from '@/api/client';
import { formatMoney } from '@/utils/format';

type HistoryItem = {
  productName: string; specLabel: string; weight: number; unitPrice: number; subtotal: number;
};

type HistoryRecord = {
  id: string; taskDate: string; status: string; plannedWeight: number; actualWeight: number;
  operator: string; items: HistoryItem[];
};

type Merchant = {
  id: string; name: string; type: string; contactName: string; phone: string;
  address: string; settlementDay: string; discountRate: number;
  basketCount: number; status: string; deliveryHistory?: HistoryRecord[];
};

export default function MerchantConfig() {
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

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/merchants/${editing.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/merchants', values);
        message.success('新增成功');
      }
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleToggle = async (merchant: Merchant) => {
    await api.put(`/merchants/${merchant.id}`, { status: merchant.status === '启用' ? '停用' : '启用' });
    load();
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

  const columns = [
    { title: '商户名称', dataIndex: 'name', key: 'name', width: 140 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 80, render: (v: string) => <Tag>{v}</Tag> },
    { title: '联系人', dataIndex: 'contactName', key: 'contactName', width: 80 },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 120 },
    { title: '地址', dataIndex: 'address', key: 'address', ellipsis: true },
    { title: '结算日', dataIndex: 'settlementDay', key: 'settlementDay', width: 100 },
    { title: '持有筐', dataIndex: 'basketCount', key: 'basketCount', width: 70, render: (v: number) => `${v}个` },
    { title: '折扣', dataIndex: 'discountRate', key: 'discountRate', width: 70, render: (v: number) => v === 1 ? '-' : `${v * 10}%` },
    { title: '状态', dataIndex: 'status', key: 'status', width: 70, render: (s: string) => <Tag color={s === '启用' ? 'green' : 'red'}>{s}</Tag> },
    {
      title: '操作', key: 'action', width: 200,
      render: (_: any, record: Merchant) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(record); form.setFieldsValue(record); setModalOpen(true);
          }}>编辑</Button>
          <Button size="small" icon={<HistoryOutlined />} onClick={() => handleShowHistory(record)}>历史</Button>
          <Popconfirm title={`确定${record.status === '启用' ? '停用' : '启用'}？`} onConfirm={() => handleToggle(record)}>
            <Button size="small" danger={record.status === '启用'} icon={record.status === '启用' ? <StopOutlined /> : <PlayCircleOutlined />}>
              {record.status === '启用' ? '停用' : '启用'}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card title="商户管理" extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          新增商户
        </Button>
      }>
        <Table dataSource={merchants} columns={columns} rowKey="id" loading={loading} size="small" />
      </Card>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editing ? '编辑商户' : '新增商户'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="商户名称" rules={[{ required: true, message: '请输入商户名称' }]}>
            <Input />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="type" label="类型" initialValue="超市" style={{ flex: 1 }}>
              <Select options={[
                { value: '超市', label: '超市' },
                { value: '小商贩', label: '小商贩' },
                { value: '散户', label: '散户' },
                { value: '其他', label: '其他' },
              ]} />
            </Form.Item>
            <Form.Item name="contactName" label="联系人" style={{ flex: 1 }}><Input /></Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="phone" label="电话" style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item name="settlementDay" label="结算日" style={{ flex: 1 }}><Input /></Form.Item>
          </div>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="discountRate" label="折扣率（1=不打折）" initialValue={1} style={{ flex: 1 }}>
              <Input type="number" step="0.05" min="0" max="1" />
            </Form.Item>
            <Form.Item name="basketCount" label="当前持有筐数" initialValue={0} style={{ flex: 1 }}>
              <Input type="number" min={0} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* 配货历史弹窗 */}
      <Modal
        title={`配货历史 - ${historyMerchant?.name || ''}`}
        open={historyOpen}
        onCancel={() => { setHistoryOpen(false); setHistoryMerchant(null); }}
        footer={null}
        width={800}
      >
        {historyMerchant && (
          <>
            <Descriptions column={3} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="商户类型">{historyMerchant.type}</Descriptions.Item>
              <Descriptions.Item label="联系人">{historyMerchant.contactName || '-'}</Descriptions.Item>
              <Descriptions.Item label="电话">{historyMerchant.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>{historyMerchant.address || '-'}</Descriptions.Item>
              <Descriptions.Item label="结算日">{historyMerchant.settlementDay || '-'}</Descriptions.Item>
            </Descriptions>
            <Table
              dataSource={historyMerchant.deliveryHistory || []}
              rowKey="id"
              loading={historyLoading}
              size="small"
              pagination={false}
              columns={[
                { title: '日期', dataIndex: 'taskDate', width: 100 },
                {
                  title: '商品', key: 'items', render: (_: any, r: HistoryRecord) =>
                    r.items?.map(i => `${i.productName} ${i.weight}斤`).join('、') || '-',
                },
                { title: '应配', dataIndex: 'plannedWeight', width: 80, render: (v: number) => `${v}斤` },
                { title: '实秤', dataIndex: 'actualWeight', width: 80, render: (v: number) => v > 0 ? `${v}斤` : '-' },
                { title: '操作员', dataIndex: 'operator', width: 80 },
                {
                  title: '状态', dataIndex: 'status', width: 80,
                  render: (s: string) => <Tag color={s === '已完成' ? 'green' : 'default'}>{s}</Tag>,
                },
              ]}
            />
            {(!historyMerchant.deliveryHistory || historyMerchant.deliveryHistory.length === 0) && (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>暂无配货历史</div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
