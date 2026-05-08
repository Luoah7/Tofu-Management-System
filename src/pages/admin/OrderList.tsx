import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Input, Tag, Space, message, Modal } from 'antd';
import { api } from '@/api/client';

const { TextArea } = Input;

type Task = {
  id: string;
  merchantName: string;
  status: string;
  plannedWeight: number;
  actualWeight: number;
  operator: string;
  items: Array<{ productName: string; plannedWeight: number }>;
};

export default function OrderList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [parseModalOpen, setParseModalOpen] = useState(false);
  const [parseText, setParseText] = useState('');
  const [parseLoading, setParseLoading] = useState(false);
  const [search, setSearch] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const load = () => {
    setLoading(true);
    api.get<Task[]>(`/tasks?date=${today}`).then(setTasks).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleParse = async () => {
    if (!parseText.trim()) {
      message.warning('请输入订货文本');
      return;
    }
    setParseLoading(true);
    try {
      const result = await api.post<Task[]>('/tasks/parse-wechat', { text: parseText, date: today });
      message.success(`成功解析 ${result.length} 个任务`);
      setParseModalOpen(false);
      setParseText('');
      load();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setParseLoading(false);
    }
  };

  const filtered = tasks.filter(t =>
    !search || t.merchantName.includes(search) || t.items.some(i => i.productName.includes(search))
  );

  const statusColors: Record<string, string> = {
    '待配货': 'default', '待复秤': 'processing', '待拍照': 'warning',
    '待送达': 'orange', '已完成': 'success', '异常': 'error',
  };

  const columns = [
    { title: '商户', dataIndex: 'merchantName', key: 'merchantName' },
    {
      title: '商品', key: 'items',
      render: (_: any, r: Task) => r.items.map(i => `${i.productName} ${i.plannedWeight}斤`).join('、'),
    },
    { title: '应配重量', dataIndex: 'plannedWeight', key: 'plannedWeight', render: (v: number) => `${v}斤` },
    { title: '实秤重量', dataIndex: 'actualWeight', key: 'actualWeight', render: (v: number) => v > 0 ? `${v}斤` : '-' },
    { title: '操作员', dataIndex: 'operator', key: 'operator' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag>,
    },
  ];

  return (
    <div>
      <Card title="订单供货" extra={
        <Space>
          <Input.Search placeholder="搜索商户/商品" style={{ width: 200 }} onSearch={setSearch} allowClear />
          <Button type="primary" onClick={() => setParseModalOpen(true)}>微信文本解析</Button>
        </Space>
      }>
        <Table dataSource={filtered} columns={columns} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title="微信订货文本解析"
        open={parseModalOpen}
        onOk={handleParse}
        onCancel={() => { setParseModalOpen(false); setParseText(''); }}
        confirmLoading={parseLoading}
        okText="解析并生成任务"
        width={600}
      >
        <p style={{ color: '#999', marginBottom: 8 }}>格式：商户名：商品1 X斤，商品2 Y斤</p>
        <p style={{ color: '#999', marginBottom: 12 }}>示例：东桥超市：豆腐 20斤，黑豆腐 10斤</p>
        <TextArea
          rows={8}
          value={parseText}
          onChange={e => setParseText(e.target.value)}
          placeholder="粘贴微信订货消息..."
        />
      </Modal>
    </div>
  );
}
