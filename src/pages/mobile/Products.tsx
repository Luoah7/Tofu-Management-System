import React, { useEffect, useState } from 'react';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Spin,
  message,
} from 'antd';
import {
  ChevronLeft,
  Package2,
  Pencil,
  Plus,
  Shapes,
  Tag,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { EmptyState, SectionHeading } from '@/components/mobile/shared';
import { formatMoney } from '@/utils/format';

type Spec = {
  id: string;
  productId: string;
  label: string;
  unitPrice: number;
  sortOrder: number;
};

type Product = {
  id: string;
  name: string;
  category: string;
  status: string;
  specs: Spec[];
};

export default function MobileProducts() {
  const navigate = useNavigate();
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

  useEffect(() => {
    load();
  }, []);

  const openCreateProduct = () => {
    setEditingProduct(null);
    productForm.resetFields();
    setProductModalOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    productForm.setFieldsValue(product);
    setProductModalOpen(true);
  };

  const openCreateSpec = (productId: string) => {
    setEditingSpec({ productId, spec: null });
    specForm.resetFields();
    setSpecModalOpen(true);
  };

  const openEditSpec = (productId: string, spec: Spec) => {
    setEditingSpec({ productId, spec });
    specForm.setFieldsValue(spec);
    setSpecModalOpen(true);
  };

  const handleSaveProduct = async () => {
    const values = await productForm.validateFields();
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, values);
        message.success('商品已更新');
      } else {
        await api.post('/products', { ...values, specs: [] });
        message.success('商品已新增');
      }
      setProductModalOpen(false);
      setEditingProduct(null);
      productForm.resetFields();
      load();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleSaveSpec = async () => {
    if (!editingSpec) return;
    const values = await specForm.validateFields();
    try {
      if (editingSpec.spec) {
        await api.put(`/products/spec/${editingSpec.spec.id}`, values);
        message.success('规格已更新');
      } else {
        await api.post(`/products/${editingSpec.productId}/specs`, values);
        message.success('规格已新增');
      }
      setSpecModalOpen(false);
      setEditingSpec(null);
      specForm.resetFields();
      load();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleDeleteSpec = async (specId: string) => {
    try {
      await api.del(`/products/spec/${specId}`);
      message.success('规格已删除');
      load();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  return (
    <div className="mobile-page">
      <section className="mobile-hero mobile-rise">
        <button type="button" className="mobile-back-button" onClick={() => navigate('/mobile/manage')}>
          <ChevronLeft size={18} />
        </button>
        <div className="mobile-hero__title">商品管理</div>
        <div className="mobile-hero__meta">
          <span>共 {products.length} 个商品</span>
        </div>
      </section>

      <div className="mobile-toolbar mobile-rise" style={{ animationDelay: '80ms' }}>
        <Button
          type="primary"
          className="mobile-primary-button"
          icon={<Plus size={16} />}
          onClick={openCreateProduct}
        >
          新增商品
        </Button>
      </div>

      <SectionHeading title="商品" extra={`${products.length} 个`} />

      {loading ? (
        <div className="mobile-loading">
          <Spin size="large" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState title="还没有商品" />
      ) : (
        <div className="mobile-record-stack">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="mobile-record-card mobile-rise"
              style={{ animationDelay: `${110 + index * 50}ms` }}
            >
              <div className="mobile-record-card__head">
                <div>
                  <div className="mobile-record-card__title">{product.name}</div>
                  <div className="mobile-record-card__meta">
                    <Package2 size={14} />
                    <span>{product.category || '未分类'}</span>
                  </div>
                </div>
                <div className="mobile-record-card__stat">
                  <span>规格</span>
                  <strong>{product.specs.length}</strong>
                </div>
              </div>

              <div className="mobile-product-spec-list">
                {product.specs.length === 0 ? (
                  <div className="mobile-record-card__dim">还没有规格</div>
                ) : (
                  product.specs.map(spec => (
                    <div key={spec.id} className="mobile-product-spec">
                      <div>
                        <div className="mobile-product-spec__title">{spec.label}</div>
                        <div className="mobile-product-spec__price">{formatMoney(spec.unitPrice)}/斤</div>
                      </div>
                      <div className="mobile-product-spec__actions">
                        <button type="button" className="mobile-icon-action" onClick={() => openEditSpec(product.id, spec)}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="mobile-icon-action" onClick={() => handleDeleteSpec(spec.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mobile-record-card__actions">
                <button type="button" className="mobile-inline-action" onClick={() => openEditProduct(product)}>
                  <Tag size={15} />
                  编辑商品
                </button>
                <button type="button" className="mobile-inline-action" onClick={() => openCreateSpec(product.id)}>
                  <Shapes size={15} />
                  添加规格
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        title={editingProduct ? '编辑商品' : '新增商品'}
        open={productModalOpen}
        onOk={handleSaveProduct}
        onCancel={() => {
          setProductModalOpen(false);
          setEditingProduct(null);
          productForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        rootClassName="mobile-dialog"
      >
        <Form form={productForm} layout="vertical">
          <Form.Item name="name" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingSpec?.spec ? '编辑规格' : '新增规格'}
        open={specModalOpen}
        onOk={handleSaveSpec}
        onCancel={() => {
          setSpecModalOpen(false);
          setEditingSpec(null);
          specForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        rootClassName="mobile-dialog"
      >
        <Form form={specForm} layout="vertical">
          <Form.Item name="label" label="规格名称" rules={[{ required: true, message: '请输入规格名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unitPrice" label="单价" rules={[{ required: true, message: '请输入单价' }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={0.5} precision={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
