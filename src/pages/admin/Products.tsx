import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Tag, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '@/api/client';
import { formatMoney } from '@/utils/format';

type Spec = {
  id: string; productId: string; label: string; unitPrice: number; sortOrder: number;
};

type Product = {
  id: string; name: string; category: string; status: string; specs: Spec[];
};

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingSpec, setEditingSpec] = useState<{ productId: string; spec: Spec | null } | null>(null);
  const [productForm] = Form.useForm();
  const [specForm] = Form.useForm();

  const load = () => {
    setLoading(true);
    api.get<Product[]>('/products').then(setProducts).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSaveProduct = async () => {
    const values = await productForm.validateFields();
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/products', { ...values, specs: [] });
        message.success('新增成功');
      }
      setProductModalOpen(false);
      productForm.resetFields();
      setEditingProduct(null);
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleSaveSpec = async () => {
    if (!editingSpec) return;
    const values = await specForm.validateFields();
    try {
      if (editingSpec.spec) {
        await api.put(`/products/spec/${editingSpec.spec.id}`, values);
        message.success('规格更新成功');
      } else {
        await api.post(`/products/${editingSpec.productId}/specs`, values);
        message.success('规格新增成功');
      }
      setSpecModalOpen(false);
      specForm.resetFields();
      setEditingSpec(null);
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleDeleteSpec = async (specId: string) => {
    await api.del(`/products/spec/${specId}`);
    message.success('规格已删除');
    load();
  };

  const productColumns = [
    { title: '商品名称', dataIndex: 'name', key: 'name', width: 140 },
    { title: '分类', dataIndex: 'category', key: 'category', width: 100 },
    {
      title: '规格/价格', key: 'specs',
      render: (_: any, record: Product) => (
        <Space size="small" wrap>
          {record.specs.map(s => (
            <Tag key={s.id} color="blue">{s.label}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (s: string) => <Tag color={s === '启用' ? 'green' : 'red'}>{s}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 280,
      render: (_: any, record: Product) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditingProduct(record);
            productForm.setFieldsValue(record);
            setProductModalOpen(true);
          }}>编辑</Button>
          <Button size="small" icon={<PlusOutlined />} type="dashed" onClick={() => {
            setEditingSpec({ productId: record.id, spec: null });
            specForm.resetFields();
            setSpecModalOpen(true);
          }}>添加规格</Button>
        </Space>
      ),
    },
  ];

  // 展开行：显示规格列表
  const expandedRowRender = (product: Product) => (
    <Table
      size="small"
      pagination={false}
      dataSource={product.specs}
      rowKey="id"
      columns={[
        { title: '规格名称', dataIndex: 'label' },
        { title: '单价', dataIndex: 'unitPrice', render: (v: number) => `${formatMoney(v)}/斤` },
        {
          title: '操作', key: 'action', width: 140,
          render: (_: any, spec: Spec) => (
            <Space>
              <Button size="small" onClick={() => {
                setEditingSpec({ productId: product.id, spec });
                specForm.setFieldsValue(spec);
                setSpecModalOpen(true);
              }}>编辑</Button>
              <Popconfirm title="确定删除此规格？" onConfirm={() => handleDeleteSpec(spec.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          ),
        },
      ]}
    />
  );

  return (
    <div>
      <Card title="商品管理" extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditingProduct(null); productForm.resetFields(); setProductModalOpen(true);
        }}>新增商品</Button>
      }>
        <Table
          dataSource={products}
          columns={productColumns}
          rowKey="id"
          loading={loading}
          expandable={{ expandedRowRender }}
        />
      </Card>

      {/* 商品新增/编辑 */}
      <Modal
        title={editingProduct ? '编辑商品' : '新增商品'}
        open={productModalOpen}
        onOk={handleSaveProduct}
        onCancel={() => { setProductModalOpen(false); setEditingProduct(null); productForm.resetFields(); }}
      >
        <Form form={productForm} layout="vertical">
          <Form.Item name="name" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类" initialValue="">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* 规格新增/编辑 */}
      <Modal
        title={editingSpec?.spec ? '编辑规格' : '添加规格'}
        open={specModalOpen}
        onOk={handleSaveSpec}
        onCancel={() => { setSpecModalOpen(false); setEditingSpec(null); specForm.resetFields(); }}
      >
        <Form form={specForm} layout="vertical">
          <Form.Item name="label" label="规格名称" rules={[{ required: true, message: '请输入规格名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unitPrice" label="单价（元/斤）" rules={[{ required: true, message: '请输入单价' }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={0.5} precision={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
