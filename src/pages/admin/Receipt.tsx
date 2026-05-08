import React, { useEffect, useState } from 'react';
import { Card, Select, Space } from 'antd';
import { api } from '@/api/client';
import { businessProfile } from '@/config/public';

type Task = { id: string; merchantName: string; items: Array<{ productName: string }> };
type ReceiptData = {
  merchantName: string;
  merchantAddress: string;
  items: Array<{ name: string; spec: string; weight: number; unitPrice: number; subtotal: number }>;
  totalAmount: number;
  operator: string;
  date: string;
  receiptNo: string;
};

export default function Receipt() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [paperWidth, setPaperWidth] = useState(58);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    api.get<Task[]>(`/tasks?date=${today}`).then(setTasks);
  }, []);

  useEffect(() => {
    if (selectedTaskId) {
      api.get<ReceiptData>(`/receipts/${selectedTaskId}`).then(setReceipt);
    } else {
      setReceipt(null);
    }
  }, [selectedTaskId]);

  const receiptWidth = paperWidth === 58 ? 220 : 300;
  const fontSize = paperWidth === 58 ? 10 : 11;
  const headerFontSize = paperWidth === 58 ? 12 : 14;

  const divider = (char = '-', count = 30) => (
    <div style={{ textAlign: 'center', margin: '4px 0', letterSpacing: 2, color: '#333' }}>
      {char.repeat(count)}
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <Card title="热敏打印机小票预览">
        <Space style={{ marginBottom: 16 }}>
          <span>选择任务：</span>
          <Select style={{ width: 200 }} placeholder="请选择配货任务" value={selectedTaskId || undefined} onChange={setSelectedTaskId}>
            {tasks.map(t => (
              <Select.Option key={t.id} value={t.id}>{t.merchantName} - {t.items.length}种商品</Select.Option>
            ))}
          </Select>
          <span>纸张宽度：</span>
          <Select style={{ width: 100 }} value={paperWidth} onChange={setPaperWidth}>
            <Select.Option value={58}>58mm</Select.Option>
            <Select.Option value={80}>80mm</Select.Option>
          </Select>
        </Space>

        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <h4 style={{ marginBottom: 12 }}>小票预览效果</h4>
            <div style={{ background: '#f0f0f0', padding: 20, borderRadius: 8, display: 'flex', justifyContent: 'center' }}>
              {receipt ? (
                <div style={{
                  width: receiptWidth, margin: '0 auto', padding: '12px 8px', background: '#fff',
                  fontFamily: '"Courier New", monospace', fontSize, lineHeight: 1.4, color: '#000',
                  border: '1px dashed #ccc', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}>
                  <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: headerFontSize, fontWeight: 700, letterSpacing: 2 }}>{businessProfile.name}</div>
                    {businessProfile.address ? (
                      <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>{businessProfile.address}</div>
                    ) : null}
                    {businessProfile.phone ? <div style={{ fontSize: 9, color: '#666' }}>电话：{businessProfile.phone}</div> : null}
                  </div>
                  {divider('=')}
                  <div style={{ margin: '4px 0' }}>
                    <div>单号：{receipt.receiptNo}</div>
                    <div>日期：{receipt.date}</div>
                    <div>商户：{receipt.merchantName}</div>
                    <div>地址：{receipt.merchantAddress}</div>
                  </div>
                  {divider('-')}
                  <div style={{ margin: '4px 0' }}>
                    <div style={{ display: 'flex', fontWeight: 600, borderBottom: '1px dashed #ccc', paddingBottom: 2 }}>
                      <span style={{ flex: 2 }}>商品</span>
                      <span style={{ flex: 1, textAlign: 'right' }}>重量</span>
                      <span style={{ flex: 1, textAlign: 'right' }}>金额</span>
                    </div>
                    {receipt.items.map((item, idx) => (
                      <div key={idx} style={{ padding: '2px 0' }}>
                        <div style={{ display: 'flex' }}>
                          <span style={{ flex: 2 }}>{item.name}</span>
                          <span style={{ flex: 1, textAlign: 'right' }}>{item.weight}斤</span>
                          <span style={{ flex: 1, textAlign: 'right' }}>¥{item.subtotal.toFixed(2)}</span>
                        </div>
                        <div style={{ color: '#666', fontSize: fontSize - 1 }}>{item.spec}</div>
                      </div>
                    ))}
                  </div>
                  {divider('-')}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: fontSize + 2 }}>
                    <span>合计：</span><span>¥{receipt.totalAmount.toFixed(2)}</span>
                  </div>
                  {divider('-')}
                  <div style={{ margin: '4px 0', fontSize: 9, color: '#666' }}>
                    <div>操作员：{receipt.operator}</div>
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <div>谢谢惠顾</div><div>欢迎再次光临</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <div style={{ fontSize: 8, letterSpacing: 2, fontFamily: 'monospace' }}>||||||||||||||||||||||||||||</div>
                    <div style={{ fontSize: 8, marginTop: 2 }}>{receipt.receiptNo}</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>请选择一个配货任务查看小票预览</div>
              )}
            </div>
          </div>

          <div style={{ width: 300 }}>
            <h4 style={{ marginBottom: 12 }}>打印说明</h4>
            <div style={{ background: '#f9f9f9', padding: 16, borderRadius: 8, fontSize: 12 }}>
              <p><strong>纸张规格：</strong></p>
              <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
                <li>58mm 热敏纸（常用）</li>
                <li>80mm 热敏纸（宽幅）</li>
              </ul>
              <p><strong>打印设置：</strong></p>
              <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
                <li>纸张类型：热敏纸</li>
                <li>打印方向：纵向</li>
                <li>边距：无</li>
                <li>缩放：100%</li>
              </ul>
              <p><strong>适用场景：</strong></p>
              <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
                <li>配货现场打印</li>
                <li>商户签收凭证</li>
                <li>临时收款收据</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
