import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Select, Tag, Space, message, Descriptions, InputNumber, Form, DatePicker } from 'antd';
import { PlusOutlined, EyeOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '@/api/client';
import { businessProfile } from '@/config/public';
import { formatMoney, amountToChinese } from '@/utils/format';

type Settlement = {
  id: string;
  merchantId: string;
  merchantName: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  paidAmount: number;
  payStatus: string;
  payMethod: string;
  operator: string;
  note: string;
  items: Array<{
    id: string;
    taskDate: string;
    productName: string;
    specLabel: string;
    weight: number;
    unitPrice: number;
    subtotal: number;
  }>;
};

type Merchant = { id: string; name: string };

export default function Settlement() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selected, setSelected] = useState<Settlement | null>(null);
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [periodStart, setPeriodStart] = useState(dayjs().subtract(30, 'day').format('YYYY-MM-DD'));
  const [periodEnd, setPeriodEnd] = useState(dayjs().format('YYYY-MM-DD'));
  const [generating, setGenerating] = useState(false);
  const [payForm] = Form.useForm();

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<Settlement[]>('/settlements'),
      api.get<Merchant[]>('/merchants'),
    ]).then(([s, m]) => {
      setSettlements(s);
      setMerchants(m);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    if (!selectedMerchantId) { message.warning('请选择商户'); return; }
    if (!periodStart || !periodEnd) { message.warning('请选择账期范围'); return; }
    setGenerating(true);
    try {
      const merchant = merchants.find(m => m.id === selectedMerchantId);
      await api.post('/settlements/generate', {
        merchantId: selectedMerchantId,
        periodStart,
        periodEnd,
      });
      message.success(`已为${merchant?.name}生成结算单`);
      setGenerateModalOpen(false);
      setSelectedMerchantId('');
      load();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdatePay = async () => {
    if (!selected) return;
    const values = await payForm.validateFields();
    try {
      await api.put(`/settlements/${selected.id}`, values);
      message.success('更新成功');
      setPayModalOpen(false);
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handlePrint = (stl: Settlement) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const contactLine = [
      businessProfile.address,
      businessProfile.phone ? `电话：${businessProfile.phone}` : '',
    ].filter(Boolean).join(' | ');
    const html = `<!DOCTYPE html><html><head><title>${businessProfile.name} - 结算单</title><style>
      @page { size: A4; margin: 20mm; }
      body { font-family: SimSun, serif; font-size: 12pt; color: #000; }
      h1 { text-align: center; font-size: 18pt; margin-bottom: 4px; }
      .sub { text-align: center; color: #666; font-size: 10pt; margin-bottom: 16px; }
      .info { margin-bottom: 12px; font-size: 11pt; }
      .info span { margin-right: 24px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
      th { background: #f5f5f5; font-weight: bold; }
      td:nth-child(n+4) { text-align: right; }
      .total { font-size: 14pt; font-weight: bold; margin: 12px 0; }
      .chinese { color: #333; margin-bottom: 24px; }
      .signatures { display: flex; justify-content: space-between; margin-top: 48px; }
      .sign-box { width: 45%; }
      .sign-line { border-bottom: 1px solid #000; height: 40px; margin-bottom: 4px; }
      .footer { margin-top: 32px; text-align: center; color: #999; font-size: 9pt; }
    </style></head><body>
      <h1>${businessProfile.name}</h1>
      ${contactLine ? `<div class="sub">${contactLine}</div>` : ''}
      <div class="sub" style="font-size:14pt;margin:8px 0 16px">结 算 单</div>
      <div class="info">
        <span>商户：${stl.merchantName}</span>
        <span>账期：${stl.periodStart} 至 ${stl.periodEnd}</span>
      </div>
      <table>
        <thead><tr><th>日期</th><th>商品</th><th>规格</th><th>重量</th><th>单价</th><th>小计</th></tr></thead>
        <tbody>
          ${stl.items.map(item => `<tr>
            <td>${item.taskDate}</td><td>${item.productName}</td><td>${item.specLabel}</td>
            <td style="text-align:right">${item.weight}斤</td>
            <td style="text-align:right">¥${item.unitPrice}/斤</td>
            <td style="text-align:right">¥${item.subtotal.toFixed(2)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="total">合计：${formatMoney(stl.totalAmount)}</div>
      <div class="chinese">大写：人民币${amountToChinese(stl.totalAmount)}</div>
      <div class="signatures">
        <div class="sign-box"><p>供货方签字：</p><div class="sign-line"></div></div>
        <div class="sign-box"><p>收货方签字：</p><div class="sign-line"></div></div>
      </div>
      <div class="footer">制单日期：${new Date().toLocaleDateString('zh-CN')} | 制单人：${stl.operator || '—'}</div>
    </body></html>`;
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const statusColors: Record<string, string> = {
    '未收款': 'warning', '部分收款': 'processing', '已收款': 'success', '逾期': 'error',
  };

  const columns = [
    { title: '商户', dataIndex: 'merchantName', key: 'merchantName' },
    { title: '账期', key: 'period', render: (_: any, r: Settlement) => `${r.periodStart} ~ ${r.periodEnd}` },
    { title: '总金额', dataIndex: 'totalAmount', key: 'totalAmount', render: (v: number) => formatMoney(v) },
    { title: '已收', dataIndex: 'paidAmount', key: 'paidAmount', render: (v: number) => formatMoney(v) },
    {
      title: '状态', dataIndex: 'payStatus', key: 'payStatus',
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag>,
    },
    {
      title: '操作', key: 'action',
      render: (_: any, r: Settlement) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelected(r); setDetailModalOpen(true); }}>明细</Button>
          <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(r)}>打印</Button>
          <Button size="small" onClick={() => {
            setSelected(r);
            payForm.setFieldsValue({ payStatus: r.payStatus, payMethod: r.payMethod, paidAmount: r.paidAmount });
            setPayModalOpen(true);
          }}>收款</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card title="结算管理" extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setGenerateModalOpen(true)}>生成结算单</Button>
      }>
        <Table dataSource={settlements} columns={columns} rowKey="id" loading={loading} />
      </Card>

      <Modal title="生成结算单" open={generateModalOpen} onOk={handleGenerate}
        onCancel={() => setGenerateModalOpen(false)} confirmLoading={generating}>
        <Form layout="vertical">
          <Form.Item label="选择商户" required>
            <Select placeholder="选择商户" value={selectedMerchantId || undefined}
              onChange={setSelectedMerchantId}>
              {merchants.map(m => <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item label="账期开始" required style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} value={dayjs(periodStart)}
                onChange={(d) => d && setPeriodStart(d.format('YYYY-MM-DD'))} />
            </Form.Item>
            <Form.Item label="账期结束" required style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} value={dayjs(periodEnd)}
                onChange={(d) => d && setPeriodEnd(d.format('YYYY-MM-DD'))} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal title="结算明细" open={detailModalOpen} onCancel={() => setDetailModalOpen(false)} footer={null} width={800}>
        {selected && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="商户">{selected.merchantName}</Descriptions.Item>
              <Descriptions.Item label="账期">{selected.periodStart} ~ {selected.periodEnd}</Descriptions.Item>
              <Descriptions.Item label="总金额">{formatMoney(selected.totalAmount)}</Descriptions.Item>
              <Descriptions.Item label="收款状态"><Tag color={statusColors[selected.payStatus]}>{selected.payStatus}</Tag></Descriptions.Item>
            </Descriptions>
            <Table dataSource={selected.items} rowKey="id" pagination={false} size="small" columns={[
              { title: '日期', dataIndex: 'taskDate' },
              { title: '商品', dataIndex: 'productName' },
              { title: '规格', dataIndex: 'specLabel' },
              { title: '重量', dataIndex: 'weight', render: (v: number) => `${v}斤` },
              { title: '单价', dataIndex: 'unitPrice', render: (v: number) => `¥${v}/斤` },
              { title: '小计', dataIndex: 'subtotal', render: (v: number) => formatMoney(v) },
            ]} />
          </>
        )}
      </Modal>

      <Modal title="更新收款" open={payModalOpen} onOk={handleUpdatePay}
        onCancel={() => setPayModalOpen(false)}>
        <Form form={payForm} layout="vertical">
          <Form.Item name="payStatus" label="收款状态">
            <Select options={['未收款', '部分收款', '已收款', '逾期'].map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="payMethod" label="收款方式">
            <Select options={['微信', '支付宝', '对公转账'].map(v => ({ value: v, label: v }))} allowClear />
          </Form.Item>
          <Form.Item name="paidAmount" label="已收金额">
            <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
