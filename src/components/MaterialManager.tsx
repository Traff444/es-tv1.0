import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, hasValidCredentials } from '../lib/supabase';
import {
  Material,
  MaterialCategory,
  Warehouse,
  Supplier,
  MaterialInventory,
} from '../types';
import { 
  Plus, 
  Package, 
  Edit3, 
  Trash2, 
  Search,
  DollarSign,
  Hash,
  Calendar,
  AlertCircle,
  Check,
  X,
  Filter,
  Warehouse as WarehouseIcon,
  Users,
  Tag,
  AlertTriangle,
  MapPin,
  Building,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface EditingItem
  extends Partial<Material>,
    Partial<MaterialCategory>,
    Partial<Warehouse>,
    Partial<Supplier> {}

interface MaterialManagerProps {
  onNavigate?: (view: string) => void;
}

export const MaterialManager: React.FC<MaterialManagerProps> = ({ onNavigate }) => {
  const { profile } = useAuth();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'materials' | 'categories' | 'warehouses' | 'suppliers'
  >('materials');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const isConfigured = hasValidCredentials && !!supabase;

  useEffect(() => {
    if (isConfigured) {
      fetchData();
    }
  }, [isConfigured]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchMaterials(),
      fetchCategories(),
      fetchWarehouses(),
      fetchSuppliers()
    ]);
    setLoading(false);
  };

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from('materials')
      .select(`
        *,
        category:category_id(id, name, color),
        inventory:material_inventory(
          id,
          warehouse_id,
          task_id,
          quantity,
          location_type,
          warehouse:warehouse_id(id, name)
        )
      `)
      .order('name');

    if (!error && data) {
      setMaterials(data);
    }
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('material_categories')
      .select('*')
      .order('name');

    if (!error && data) {
      setCategories(data);
    }
  };

  const fetchWarehouses = async () => {
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .order('name');

    if (!error && data) {
      setWarehouses(data);
    }
  };

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');

    if (!error && data) {
      setSuppliers(data);
    }
  };

  const deleteItem = async (table: string, id: string) => {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (!error) {
      fetchData();
      setDeleteConfirm(null);
    } else {
      alert('Ошибка при удалении. Возможно, элемент используется в других записях.');
    }
  };

  const getTotalStock = (material: Material) => {
    if (!material.inventory) return 0;
    return material.inventory
      .filter((inv: MaterialInventory) => inv.location_type === 'warehouse')
      .reduce((sum, inv) => sum + inv.quantity, 0);
  };

  const getOnSiteStock = (material: Material) => {
    if (!material.inventory) return 0;
    return material.inventory
      .filter((inv: MaterialInventory) => inv.location_type === 'on_site')
      .reduce((sum, inv) => sum + inv.quantity, 0);
  };

  const isLowStock = (material: Material) => {
    const totalStock = getTotalStock(material);
    return totalStock <= material.min_stock_quantity;
  };

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || material.category_id === categoryFilter;
    const matchesWarehouse = warehouseFilter === 'all' ||
      (material.inventory && material.inventory.some(inv =>
        inv.location_type === 'warehouse' && inv.warehouse_id === warehouseFilter
      ));
    return matchesSearch && matchesCategory && matchesWarehouse;
  });

  return !isConfigured ? (
    <div className="text-center py-12">
      <div className="text-xl font-semibold text-gray-900 mb-2">Ошибка конфигурации</div>
      <p className="text-gray-600">Система не настроена для работы с базой данных</p>
    </div>
  ) : loading ? (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  ) : (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            {onNavigate && (
              <button
                onClick={() => onNavigate('dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Назад к дашборду</span>
              </button>
            )}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Управление материалами</h1>
                <p className="text-gray-600">Контроль складских остатков, категорий и поставщиков</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('materials')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'materials'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Материалы</span>
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'categories'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Категории</span>
          </button>
          <button
            onClick={() => setActiveTab('warehouses')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'warehouses'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <WarehouseIcon className="w-4 h-4" />
            <span>Склады</span>
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'suppliers'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Поставщики</span>
          </button>
        </div>
      </div>

      {/* Materials Tab */}
      {activeTab === 'materials' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Поиск материалов..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Все категории</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <Building className="w-4 h-4 text-gray-500" />
                <select
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Все склады</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить</span>
              </button>
            </div>
          </div>

          {/* Materials Grid */}
          {filteredMaterials.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'Материалы не найдены' : 'Нет материалов'}
              </h3>
              <p className="text-gray-500">
                {searchTerm ? 'Попробуйте изменить поисковый запрос' : 'Добавьте первый материал для начала работы'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMaterials.map((material) => (
                <div
                  key={material.id}
                  className={`bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow ${
                    isLowStock(material) ? 'border-red-200 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold text-gray-900">{material.name}</h3>
                        {isLowStock(material) && (
                          <AlertTriangle className="w-4 h-4 text-red-500" title="Низкий остаток" />
                        )}
                      </div>
                      {material.category && (
                        <span 
                          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full"
                          style={{ 
                            backgroundColor: `${material.category.color}20`,
                            color: material.category.color 
                          }}
                        >
                          {material.category.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setEditingItem(material)}
                        className="text-blue-600 hover:text-blue-700 p-1"
                        title="Редактировать"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {deleteConfirm === material.id ? (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => deleteItem('materials', material.id)}
                            className="text-red-600 hover:text-red-700 p-1"
                            title="Подтвердить удаление"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-gray-600 hover:text-gray-700 p-1"
                            title="Отмена"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(material.id)}
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stock Info */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">На складах:</span>
                      <span className={`font-semibold ${isLowStock(material) ? 'text-red-600' : 'text-green-600'}`}>
                        {getTotalStock(material)} {material.default_unit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">На объектах:</span>
                      <span className="font-semibold text-blue-600">
                        {getOnSiteStock(material)} {material.default_unit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Мин. остаток:</span>
                      <span className="text-sm text-gray-900">
                        {material.min_stock_quantity} {material.default_unit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Стоимость:</span>
                      <span className="text-sm text-gray-900">
                        {material.cost_per_unit} BYN/{material.default_unit}
                      </span>
                    </div>
                  </div>

                  {/* Warehouse Details */}
                  {material.inventory && material.inventory.length > 0 && (
                    <div className="border-t border-gray-100 pt-3">
                      <div className="text-xs text-gray-500 mb-2">Распределение по складам:</div>
                      <div className="space-y-1">
                        {material.inventory
                          .filter(inv => inv.location_type === 'warehouse' && inv.quantity > 0)
                          .map((inv) => (
                            <div key={inv.id} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 flex items-center space-x-1">
                                <MapPin className="w-3 h-3" />
                                <span>{inv.warehouse?.name || 'Неизвестный склад'}</span>
                              </span>
                              <span className="font-medium">{inv.quantity} {material.default_unit}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <CategoriesTab
          categories={categories}
          onRefresh={fetchCategories}
          onEdit={setEditingItem}
          onDelete={(id) => deleteItem('material_categories', id)}
          deleteConfirm={deleteConfirm}
          setDeleteConfirm={setDeleteConfirm}
          setShowCreateForm={setShowCreateForm}
        />
      )}

      {/* Warehouses Tab */}
      {activeTab === 'warehouses' && (
        <WarehousesTab
          warehouses={warehouses}
          onRefresh={fetchWarehouses}
          onEdit={setEditingItem}
          onDelete={(id) => deleteItem('warehouses', id)}
          deleteConfirm={deleteConfirm}
          setDeleteConfirm={setDeleteConfirm}
          setShowCreateForm={setShowCreateForm}
        />
      )}

      {/* Suppliers Tab */}
      {activeTab === 'suppliers' && (
        <SuppliersTab
          suppliers={suppliers}
          onRefresh={fetchSuppliers}
          onEdit={setEditingItem}
          onDelete={(id) => deleteItem('suppliers', id)}
          deleteConfirm={deleteConfirm}
          setDeleteConfirm={setDeleteConfirm}
          setShowCreateForm={setShowCreateForm}
        />
      )}

      {/* Create/Edit Modal */}
      {showCreateForm && (
        <CreateEditModal
          type={activeTab}
          item={editingItem}
          categories={categories}
          warehouses={warehouses}
          onClose={() => {
            setShowCreateForm(false);
            setEditingItem(null);
          }}
          onSuccess={() => {
            setShowCreateForm(false);
            setEditingItem(null);
            fetchData();
          }}
        />
      )}

      {/* Edit Modal */}
      {editingItem && !showCreateForm && (
        <CreateEditModal
          type={activeTab}
          item={editingItem}
          categories={categories}
          warehouses={warehouses}
          onClose={() => setEditingItem(null)}
          onSuccess={() => {
            setEditingItem(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

// Categories Tab Component
interface CategoriesTabProps {
  categories: MaterialCategory[];
  onRefresh: () => void;
  onEdit: (item: EditingItem) => void;
  onDelete: (id: string) => void;
  deleteConfirm: string | null;
  setDeleteConfirm: (id: string | null) => void;
  setShowCreateForm: (show: boolean) => void;
}

const CategoriesTab: React.FC<CategoriesTabProps> = ({
  categories,
  onEdit,
  onDelete,
  deleteConfirm,
  setDeleteConfirm,
  setShowCreateForm,
}) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <h3 className="text-lg font-semibold text-gray-900">Категории материалов</h3>
      <button
        onClick={() => setShowCreateForm(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
      >
        <Plus className="w-4 h-4" />
        <span>Добавить категорию</span>
      </button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {categories.map((category) => (
        <div key={category.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <h4 className="font-medium text-gray-900">{category.name}</h4>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => onEdit(category)}
                className="text-blue-600 hover:text-blue-700 p-1"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              {deleteConfirm === category.id ? (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onDelete(category.id)}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="text-gray-600 hover:text-gray-700 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(category.id)}
                  className="text-red-600 hover:text-red-700 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {category.description && (
            <p className="text-sm text-gray-600">{category.description}</p>
          )}
        </div>
      ))}
    </div>
  </div>
);

// Warehouses Tab Component
interface WarehousesTabProps {
  warehouses: Warehouse[];
  onRefresh: () => void;
  onEdit: (item: EditingItem) => void;
  onDelete: (id: string) => void;
  deleteConfirm: string | null;
  setDeleteConfirm: (id: string | null) => void;
  setShowCreateForm: (show: boolean) => void;
}

const WarehousesTab: React.FC<WarehousesTabProps> = ({
  warehouses,
  onEdit,
  onDelete,
  deleteConfirm,
  setDeleteConfirm,
  setShowCreateForm,
}) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <h3 className="text-lg font-semibold text-gray-900">Склады</h3>
      <button
        onClick={() => setShowCreateForm(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
      >
        <Plus className="w-4 h-4" />
        <span>Добавить склад</span>
      </button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {warehouses.map((warehouse) => (
        <div key={warehouse.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <WarehouseIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{warehouse.name}</h4>
                <p className="text-sm text-gray-600">{warehouse.address}</p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => onEdit(warehouse)}
                className="text-blue-600 hover:text-blue-700 p-1"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              {deleteConfirm === warehouse.id ? (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onDelete(warehouse.id)}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="text-gray-600 hover:text-gray-700 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(warehouse.id)}
                  className="text-red-600 hover:text-red-700 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            {warehouse.contact_person && (
              <div className="flex items-center space-x-2 text-gray-600">
                <Users className="w-4 h-4" />
                <span>{warehouse.contact_person}</span>
              </div>
            )}
            {warehouse.phone && (
              <div className="flex items-center space-x-2 text-gray-600">
                <span>📞</span>
                <span>{warehouse.phone}</span>
              </div>
            )}
            {warehouse.email && (
              <div className="flex items-center space-x-2 text-gray-600">
                <span>✉️</span>
                <span>{warehouse.email}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Suppliers Tab Component
interface SuppliersTabProps {
  suppliers: Supplier[];
  onRefresh: () => void;
  onEdit: (item: EditingItem) => void;
  onDelete: (id: string) => void;
  deleteConfirm: string | null;
  setDeleteConfirm: (id: string | null) => void;
  setShowCreateForm: (show: boolean) => void;
}

const SuppliersTab: React.FC<SuppliersTabProps> = ({
  suppliers,
  onEdit,
  onDelete,
  deleteConfirm,
  setDeleteConfirm,
  setShowCreateForm,
}) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <h3 className="text-lg font-semibold text-gray-900">Поставщики</h3>
      <button
        onClick={() => setShowCreateForm(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
      >
        <Plus className="w-4 h-4" />
        <span>Добавить поставщика</span>
      </button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {suppliers.map((supplier) => (
        <div key={supplier.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{supplier.name}</h4>
                {supplier.contact_person && (
                  <p className="text-sm text-gray-600">{supplier.contact_person}</p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => onEdit(supplier)}
                className="text-blue-600 hover:text-blue-700 p-1"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              {deleteConfirm === supplier.id ? (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onDelete(supplier.id)}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="text-gray-600 hover:text-gray-700 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(supplier.id)}
                  className="text-red-600 hover:text-red-700 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            {supplier.phone && (
              <div className="flex items-center space-x-2 text-gray-600">
                <span>📞</span>
                <span>{supplier.phone}</span>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center space-x-2 text-gray-600">
                <span>✉️</span>
                <span>{supplier.email}</span>
              </div>
            )}
            {supplier.address && (
              <div className="flex items-center space-x-2 text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>{supplier.address}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Create/Edit Modal Component
interface CreateEditModalProps {
  type: 'materials' | 'categories' | 'warehouses' | 'suppliers';
  item?: EditingItem;
  categories: MaterialCategory[];
  warehouses: Warehouse[];
  onClose: () => void;
  onSuccess: () => void;
}

const CreateEditModal: React.FC<CreateEditModalProps> = ({
  type,
  item,
  categories,
  warehouses,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<EditingItem>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (item) {
      setFormData(item);
    } else {
      // Set default values based on type
      switch (type) {
        case 'materials':
          setFormData({
            name: '',
            default_unit: 'шт',
            cost_per_unit: '',
            min_stock_quantity: '',
            category_id: '',
          });
          break;
        case 'categories':
          setFormData({
            name: '',
            description: '',
            color: '#6B7280',
          });
          break;
        case 'warehouses':
          setFormData({
            name: '',
            address: '',
            contact_person: '',
            phone: '',
            email: '',
            notes: '',
          });
          break;
        case 'suppliers':
          setFormData({
            name: '',
            contact_person: '',
            phone: '',
            email: '',
            address: '',
            notes: '',
          });
          break;
      }
    }
  }, [item, type]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    switch (type) {
      case 'materials':
        if (!formData.name?.trim()) newErrors.name = 'Название обязательно';
        if (!formData.default_unit?.trim()) newErrors.default_unit = 'Единица измерения обязательна';
        if (!formData.cost_per_unit || parseFloat(formData.cost_per_unit) < 0) {
          newErrors.cost_per_unit = 'Стоимость должна быть положительным числом';
        }
        if (!formData.min_stock_quantity || parseFloat(formData.min_stock_quantity) < 0) {
          newErrors.min_stock_quantity = 'Минимальный остаток должен быть положительным числом';
        }
        break;
      case 'categories':
        if (!formData.name?.trim()) newErrors.name = 'Название обязательно';
        break;
      case 'warehouses':
        if (!formData.name?.trim()) newErrors.name = 'Название обязательно';
        if (!formData.address?.trim()) newErrors.address = 'Адрес обязателен';
        break;
      case 'suppliers':
        if (!formData.name?.trim()) newErrors.name = 'Название обязательно';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const table = type === 'categories' ? 'material_categories' : type;
      const data = { ...formData };

      // Convert numeric fields
      if (type === 'materials') {
        data.cost_per_unit = parseFloat(data.cost_per_unit);
        data.min_stock_quantity = parseFloat(data.min_stock_quantity);
        if (!data.category_id) data.category_id = null;
      }

      if (item) {
        // Update existing item
        const { error } = await supabase
          .from(table)
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', item.id);

        if (error) throw error;
      } else {
        // Create new item
        const { error } = await supabase
          .from(table)
          .insert(data);

        if (error) throw error;
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    const action = item ? 'Редактировать' : 'Добавить';
    switch (type) {
      case 'materials': return `${action} материал`;
      case 'categories': return `${action} категорию`;
      case 'warehouses': return `${action} склад`;
      case 'suppliers': return `${action} поставщика`;
      default: return action;
    }
  };

  const commonUnits = ['шт', 'м', 'кг', 'л', 'м²', 'м³', 'упак', 'рулон', 'коробка'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">{getTitle()}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Common name field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название *
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder={`Название ${type === 'materials' ? 'материала' : type === 'categories' ? 'категории' : type === 'warehouses' ? 'склада' : 'поставщика'}`}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            {/* Material-specific fields */}
            {type === 'materials' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Категория
                  </label>
                  <select
                    value={formData.category_id || ''}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Без категории</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Единица измерения *
                  </label>
                  <select
                    value={formData.default_unit || ''}
                    onChange={(e) => setFormData({ ...formData, default_unit: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.default_unit ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    {commonUnits.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                  {errors.default_unit && <p className="text-red-500 text-sm mt-1">{errors.default_unit}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Стоимость за единицу (BYN) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost_per_unit || ''}
                    onChange={(e) => setFormData({ ...formData, cost_per_unit: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.cost_per_unit ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                  {errors.cost_per_unit && <p className="text-red-500 text-sm mt-1">{errors.cost_per_unit}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Минимальный остаток *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.min_stock_quantity || ''}
                    onChange={(e) => setFormData({ ...formData, min_stock_quantity: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.min_stock_quantity ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="0"
                  />
                  {errors.min_stock_quantity && <p className="text-red-500 text-sm mt-1">{errors.min_stock_quantity}</p>}
                </div>
              </>
            )}

            {/* Category-specific fields */}
            {type === 'categories' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Описание
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Описание категории"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Цвет
                  </label>
                  <input
                    type="color"
                    value={formData.color || '#6B7280'}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full h-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {/* Warehouse-specific fields */}
            {type === 'warehouses' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Адрес *
                  </label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.address ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Адрес склада"
                  />
                  {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ответственное лицо
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person || ''}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="ФИО ответственного"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Телефон
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Примечания
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Дополнительная информация"
                  />
                </div>
              </>
            )}

            {/* Supplier-specific fields */}
            {type === 'suppliers' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Контактное лицо
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person || ''}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="ФИО контактного лица"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Телефон
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Адрес
                  </label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Адрес поставщика"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Примечания
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Дополнительная информация"
                  />
                </div>
              </>
            )}

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Сохранение...' : (item ? 'Сохранить' : 'Добавить')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};