import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Package, 
  ShoppingCart, 
  List, 
  X, 
  Search, 
  TrendingUp, 
  Calendar, 
  User, 
  Phone, 
  MapPin, 
  CreditCard, 
  ShieldCheck, 
  Image as ImageIcon,
  Loader2,
  LogOut,
  ChevronRight,
  Trash2,
  Edit2,
  BarChart3,
  ArrowDownCircle,
  Clock
} from 'lucide-react';
import { animate, motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  increment,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { format, isToday, isSameMonth, parseISO } from 'date-fns';
import { auth, db } from './firebase';
import { Product, Sale, MobileBazarRecord } from './types';
import { uploadImageToTelegram, getTelegramImageUrl } from './services/telegramService';
import { handleFirestoreError, OperationType } from './lib/firestoreUtils';

// --- Components ---

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const Counter = ({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
    });
    return controls.stop;
  }, [value]);

  return <span>{prefix}{displayValue.toLocaleString()}{suffix}</span>;
};

const SummaryItem = ({ icon: Icon, label, value, colorClass, symbol = "", prefix = "", suffix = "" }: { icon?: any; label: string; value: string | number; colorClass: string; symbol?: string; prefix?: string; suffix?: string }) => (
  <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
    <div className={`p-3 rounded-full mb-3 ${colorClass}`}>
      {Icon ? <Icon className="w-6 h-6 text-white" /> : <span className="text-xl font-bold text-white leading-none">{symbol}</span>}
    </div>
    <span className="text-sm font-medium text-gray-500 mb-1">{label}</span>
    <span className="text-lg font-bold text-gray-900">
      {typeof value === 'number' ? <Counter value={value} prefix={prefix} suffix={suffix} /> : value}
    </span>
  </div>
);

const RestrictedAccess = ({ user, onLogout }: { user: FirebaseUser; onLogout: () => void }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center border border-red-100"
    >
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <ShieldCheck className="w-10 h-10 text-red-500" />
      </div>
      <h2 className="text-2xl font-black text-gray-900 mb-2">Access Restricted</h2>
      <p className="text-gray-500 mb-8 leading-relaxed">
        Hello <span className="font-bold text-gray-700">{user.displayName || user.email}</span>, this dashboard is reserved for the administrator only. Your current account does not have permission to view this data.
      </p>
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-sm text-gray-600">
          Logged in as: <span className="font-mono font-bold">{user.email}</span>
        </div>
        <button 
          onClick={onLogout}
          className="w-full py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" /> Sign Out
        </button>
      </div>
    </motion.div>
  </div>
);

const TelegramImage: React.FC<{ fileId: string }> = ({ fileId }) => {
  const [url, setUrl] = useState<string | null>(() => {
    const cached = localStorage.getItem(`tg_file_${fileId}`);
    if (cached) {
      try {
        const { url, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) return url;
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [error, setError] = useState(false);

  useEffect(() => {
    getTelegramImageUrl(fileId)
      .then(setUrl)
      .catch(() => setError(true));
  }, [fileId]);

  if (error) return <div className="aspect-square bg-red-50 rounded-xl flex items-center justify-center text-red-500 text-xs text-center p-2">Failed to load image</div>;
  if (!url) return <div className="aspect-square bg-gray-100 rounded-xl animate-pulse flex items-center justify-center"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-xl overflow-hidden border border-gray-100 hover:opacity-90 transition-opacity">
      <img src={url} alt="Sale" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
    </a>
  );
}

const CustomerAvatar = ({ fileId }: { fileId?: string }) => {
  const [url, setUrl] = useState<string | null>(() => {
    if (!fileId) return null;
    const cached = localStorage.getItem(`tg_file_${fileId}`);
    if (cached) {
      try {
        const { url, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) return url;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (fileId) {
      getTelegramImageUrl(fileId).then(setUrl);
    }
  }, [fileId]);

  if (url) {
    return (
      <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-100 shrink-0 shadow-sm">
        <img src={url} alt="Customer" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      </div>
    );
  }

  return (
    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 border border-gray-100">
      <User className="w-6 h-6 text-gray-400" />
    </div>
  );
};

const BannerBranding: React.FC<{ fileId: string | null }> = ({ fileId }) => {
  const [url, setUrl] = useState<string | null>(() => {
    if (!fileId) return null;
    const cached = localStorage.getItem(`tg_file_${fileId}`);
    if (cached) {
      try {
        const { url, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) return url;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (fileId) {
      getTelegramImageUrl(fileId).then(setUrl);
    } else {
      setUrl(null);
    }
  }, [fileId]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden transition-all duration-700">
      {url ? (
        <>
          <img 
            src={url} 
            alt="Banner" 
            className="w-full h-full object-cover object-center sm:object-[50%_35%]"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/40 to-transparent" />
        </>
      ) : (
        <div className="w-full h-full bg-gradient-to-r from-blue-600 to-blue-400 opacity-20" />
      )}
    </div>
  );
};

const LogoBranding: React.FC<{ fileId: string | null; className?: string }> = ({ fileId, className }) => {
  const [url, setUrl] = useState<string | null>(() => {
    if (!fileId) return null;
    const cached = localStorage.getItem(`tg_file_${fileId}`);
    if (cached) {
      try {
        const { url, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) return url;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (fileId) {
      getTelegramImageUrl(fileId).then(setUrl);
    } else {
      setUrl(null);
    }
  }, [fileId]);

  if (!url) return (
    <div className={`bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 ${className}`}>
      <ShoppingCart className="w-6 h-6 text-white" />
    </div>
  );

  return (
    <div className={`rounded-xl overflow-hidden shadow-lg shadow-blue-100 ${className}`}>
      <img 
        src={url} 
        alt="Logo" 
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

// --- Constants ---
const ADMIN_EMAIL = 'mehedyhossain160619@gmail.com';

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [mobileBazarRecords, setMobileBazarRecords] = useState<MobileBazarRecord[]>([]);
  
  const isSuperAdmin = user?.email === ADMIN_EMAIL;
  // Modals
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isSaleProductOpen, setIsSaleProductOpen] = useState(false);
  const [isCashSaleOpen, setIsCashSaleOpen] = useState(false);
  const [isSaleListOpen, setIsSaleListOpen] = useState(false);
  const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);
  const [isMobileBazarOpen, setIsMobileBazarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editSaleImages, setEditSaleImages] = useState<File[]>([]);
  const [bannerFileId, setBannerFileId] = useState<string | null>(null);
  const [logoFileId, setLogoFileId] = useState<string | null>(null);

  // Form States
  const [productSearch, setProductSearch] = useState('');
  const [reportStartDate, setReportStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [reportEndDate, setReportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [newProduct, setNewProduct] = useState({
    id: '', // For updating existing
    name: '',
    purchase_price: '',
    selling_price: '',
    quantity: '',
    ram: '',
    rom: '',
    image: null as File | null,
    image_file_id: ''
  });
  const [newSale, setNewSale] = useState({
    customer_name: '',
    phone_number: '',
    nid_number: '',
    address: '',
    guarantor_number: '',
    product_id: '',
    images: [] as File[],
    sale_date: format(new Date(), "yyyy-MM-dd'T'HH:mm")
  });
  const [cashSale, setCashSale] = useState({
    product_id: '',
    actual_sale_price: '',
    sale_date: format(new Date(), "yyyy-MM-dd'T'HH:mm")
  });
  const [newMobileBazar, setNewMobileBazar] = useState({
    sale_id: '',
    down_payment: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saleSearch, setSaleSearch] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const qProducts = query(collection(db, 'products'), orderBy('created_at', 'desc'));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    const qSales = query(collection(db, 'sales'), orderBy('sale_date', 'desc'));
    const unsubSales = onSnapshot(qSales, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sales');
    });

    const qMobileBazar = query(collection(db, 'mobile_bazar'), orderBy('created_at', 'desc'));
    const unsubMobileBazar = onSnapshot(qMobileBazar, (snapshot) => {
      setMobileBazarRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MobileBazarRecord)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'mobile_bazar');
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'shop'), (doc) => {
      if (doc.exists()) {
        setBannerFileId(doc.data().banner_file_id);
        setLogoFileId(doc.data().logo_file_id);
      }
    });

    return () => {
      unsubProducts();
      unsubSales();
      unsubMobileBazar();
      unsubSettings();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleUpdateBanner = async (file: File) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const fileId = await uploadImageToTelegram(file, (percent) => {
        setUploadProgress(prev => ({ ...prev, 'banner': percent }));
      });
      await updateDoc(doc(db, 'settings', 'shop'), {
        banner_file_id: fileId
      }).catch(async () => {
        // If doc doesn't exist, create it
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'settings', 'shop'), {
          banner_file_id: fileId
        });
      });
      alert('Banner updated successfully!');
    } catch (error: any) {
      console.error('Failed to update banner:', error);
      alert(`Failed to update banner: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(prev => {
        const next = { ...prev };
        delete next['banner'];
        return next;
      });
    }
  };

  const handleUpdateLogo = async (file: File) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const fileId = await uploadImageToTelegram(file, (percent) => {
        setUploadProgress(prev => ({ ...prev, 'logo': percent }));
      });
      await updateDoc(doc(db, 'settings', 'shop'), {
        logo_file_id: fileId
      }).catch(async () => {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'settings', 'shop'), {
          logo_file_id: fileId
        });
      });
      alert('Logo updated successfully!');
    } catch (error: any) {
      console.error('Failed to update logo:', error);
      alert(`Failed to update logo: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(prev => {
        const next = { ...prev };
        delete next['logo'];
        return next;
      });
    }
  };

  // Summary Stats
  const calculateDynamicProfit = useCallback((sale: Sale) => {
    const product = products.find(p => p.id === sale.product_id);
    if (product) {
      // If it's a cash sale or has actual_sale_price, use that.
      // Otherwise use product's current selling price.
      const sellingPrice = sale.actual_sale_price || product.selling_price;
      return sellingPrice - product.purchase_price;
    }
    return sale.profit; // Fallback to stored profit
  }, [products]);

  const currentMonthSales = useMemo(() => {
    const now = new Date();
    return sales
      .filter(s => isSameMonth(parseISO(s.sale_date), now))
      .sort((a, b) => parseISO(b.sale_date).getTime() - parseISO(a.sale_date).getTime());
  }, [sales]);

  const currentMonthTotal = useMemo(() => {
    return currentMonthSales.reduce((acc, s) => {
      if (s.actual_sale_price) return acc + s.actual_sale_price;
      const product = products.find(p => p.id === s.product_id);
      return acc + (product?.selling_price || 0);
    }, 0);
  }, [currentMonthSales, products]);

  const stats = useMemo(() => {
    const todaySales = sales.filter(s => isToday(parseISO(s.sale_date)));
    const monthlySales = sales.filter(s => isSameMonth(parseISO(s.sale_date), new Date()));
    
    const todayProfit = todaySales.reduce((acc, s) => acc + calculateDynamicProfit(s), 0);
    const monthlyProfit = monthlySales.reduce((acc, s) => acc + calculateDynamicProfit(s), 0);
    
    const mobileBazarTotal = mobileBazarRecords.reduce((acc, r) => {
      const sale = sales.find(s => s.id === r.sale_id);
      if (sale) {
        const profit = calculateDynamicProfit(sale);
        return acc + (r.down_payment - profit);
      }
      return acc + r.net_amount;
    }, 0);

    return {
      todayCount: todaySales.length,
      todayProfit,
      monthlyCount: monthlySales.length,
      monthlyProfit,
      monthlyTotalSale: currentMonthTotal,
      totalProducts: products.length,
      totalQuantity: products.reduce((acc, p) => acc + p.quantity, 0),
      totalStockValue: products.reduce((acc, p) => acc + (p.purchase_price * p.quantity), 0),
      mobileBazarTotal
    };
  }, [sales, products, mobileBazarRecords, currentMonthTotal, calculateDynamicProfit]);

  // Actions
  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const pPrice = Number(newProduct.purchase_price);
      const sPrice = Number(newProduct.selling_price);
      const profit = sPrice - pPrice;

      let imageFileId = newProduct.image_file_id;
      if (newProduct.image) {
        imageFileId = await uploadImageToTelegram(newProduct.image, (percent) => {
          setUploadProgress(prev => ({ ...prev, 'product_image': percent }));
        });
      }

      if (newProduct.id) {
        // Update existing product
        await updateDoc(doc(db, 'products', newProduct.id), {
          name: newProduct.name,
          purchase_price: pPrice,
          selling_price: sPrice,
          profit_margin: profit,
          quantity: increment(Number(newProduct.quantity)),
          ram: newProduct.ram,
          rom: newProduct.rom,
          image_file_id: imageFileId
        });
      } else {
        // Add new product
        await addDoc(collection(db, 'products'), {
          name: newProduct.name,
          purchase_price: pPrice,
          selling_price: sPrice,
          profit_margin: profit,
          quantity: Number(newProduct.quantity),
          ram: newProduct.ram,
          rom: newProduct.rom,
          image_file_id: imageFileId,
          created_at: new Date().toISOString()
        });
      }

      setNewProduct({ id: '', name: '', purchase_price: '', selling_price: '', quantity: '', ram: '', rom: '', image: null, image_file_id: '' });
      setIsAddProductOpen(false);
    } catch (error) {
      console.error('Failed to add/update product:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaleProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (newSale.images.length === 0) {
      alert('Please upload at least one image');
      return;
    }
    setIsSubmitting(true);

    try {
      const product = products.find(p => p.id === newSale.product_id);
      if (!product || product.quantity <= 0) {
        alert('Product out of stock');
        return;
      }

      // 1. Upload images to Telegram
      const imageFileIds = await Promise.all(
        newSale.images.map(file => 
          uploadImageToTelegram(file, (percent) => {
            setUploadProgress(prev => ({ ...prev, [file.name]: percent }));
          })
        )
      );

      // 2. Record sale
      await addDoc(collection(db, 'sales'), {
        customer_name: newSale.customer_name,
        phone_number: newSale.phone_number,
        nid_number: newSale.nid_number,
        address: newSale.address,
        guarantor_number: newSale.guarantor_number,
        product_id: product.id,
        product_name: product.name,
        ram: product.ram || '',
        rom: product.rom || '',
        image_file_ids: imageFileIds,
        sale_date: new Date(newSale.sale_date).toISOString(),
        profit: product.profit_margin,
        actual_sale_price: product.selling_price
      });

      // 3. Decrease stock
      await updateDoc(doc(db, 'products', product.id), {
        quantity: increment(-1)
      });

      setNewSale({
        customer_name: '',
        phone_number: '',
        nid_number: '',
        address: '',
        guarantor_number: '',
        product_id: '',
        images: [],
        sale_date: format(new Date(), "yyyy-MM-dd'T'HH:mm")
      });
      setUploadProgress({});
      setIsSaleProductOpen(false);
    } catch (error: any) {
      console.error('Failed to record sale:', error);
      alert(`Failed to record sale: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCashSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const product = products.find(p => p.id === cashSale.product_id);
      if (!product || product.quantity <= 0) {
        alert('Product out of stock');
        return;
      }

      const actualPrice = Number(cashSale.actual_sale_price);
      const profit = actualPrice - product.purchase_price;

      await addDoc(collection(db, 'sales'), {
        customer_name: 'Cash Sale',
        phone_number: 'N/A',
        nid_number: 'N/A',
        address: 'N/A',
        guarantor_number: 'N/A',
        product_id: product.id,
        product_name: product.name,
        ram: product.ram || '',
        rom: product.rom || '',
        image_file_ids: [],
        sale_date: new Date(cashSale.sale_date).toISOString(),
        profit: profit,
        actual_sale_price: actualPrice,
        is_cash_sale: true
      });

      await updateDoc(doc(db, 'products', product.id), {
        quantity: increment(-1)
      });

      setCashSale({ 
        product_id: '', 
        actual_sale_price: '',
        sale_date: format(new Date(), "yyyy-MM-dd'T'HH:mm") 
      });
      setIsCashSaleOpen(false);
    } catch (error) {
      console.error('Failed to record cash sale:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale || isSubmitting) return;
    setIsSubmitting(true);

    try {
      let updatedImageFileIds = [...editingSale.image_file_ids];

      // Upload new images if any
      if (editSaleImages.length > 0) {
        const newImageFileIds = await Promise.all(
          editSaleImages.map(file => 
            uploadImageToTelegram(file, (percent) => {
              setUploadProgress(prev => ({ ...prev, [file.name]: percent }));
            })
          )
        );
        updatedImageFileIds = [...updatedImageFileIds, ...newImageFileIds];
      }

      await updateDoc(doc(db, 'sales', editingSale.id), {
        customer_name: editingSale.customer_name,
        phone_number: editingSale.phone_number,
        nid_number: editingSale.nid_number,
        address: editingSale.address,
        guarantor_number: editingSale.guarantor_number,
        profit: Number(editingSale.profit),
        actual_sale_price: Number(editingSale.actual_sale_price || 0),
        image_file_ids: updatedImageFileIds
      });
      setEditingSale(null);
      setEditSaleImages([]);
      setUploadProgress({});
      setSelectedSale(null);
    } catch (error: any) {
      console.error('Failed to update sale:', error);
      alert(`Failed to update sale: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMobileBazarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const sale = sales.find(s => s.id === newMobileBazar.sale_id);
      if (!sale) {
        alert('Please select a valid sale');
        return;
      }

      const downPayment = Number(newMobileBazar.down_payment);
      const netAmount = downPayment - sale.profit;

      await addDoc(collection(db, 'mobile_bazar'), {
        sale_id: sale.id,
        customer_name: sale.customer_name,
        product_name: sale.product_name,
        ram: sale.ram || '',
        rom: sale.rom || '',
        down_payment: downPayment,
        sale_profit: sale.profit,
        net_amount: netAmount,
        created_at: new Date().toISOString()
      });

      setNewMobileBazar({ sale_id: '', down_payment: '' });
      setIsMobileBazarOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'mobile_bazar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetMobileBazar = async () => {
    console.log('Resetting Mobile Bazar records...', mobileBazarRecords.length);
    if (mobileBazarRecords.length === 0) {
      alert('No records to clear.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ALL ${mobileBazarRecords.length} Mobile Bazar records? This cannot be undone.`)) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      mobileBazarRecords.forEach(record => {
        console.log('Adding to batch delete:', record.id);
        batch.delete(doc(db, 'mobile_bazar', record.id));
      });
      await batch.commit();
      console.log('Batch delete successful');
      alert('All Mobile Bazar records have been cleared.');
    } catch (error) {
      console.error('Failed to reset Mobile Bazar:', error);
      handleFirestoreError(error, OperationType.DELETE, 'mobile_bazar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const search = productSearch.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(search) ||
      (p.ram && p.ram.toLowerCase().includes(search)) ||
      (p.rom && p.rom.toLowerCase().includes(search))
    );
  }, [products, productSearch]);

  const filteredSales = useMemo(() => {
    if (!saleSearch) return sales;
    const search = saleSearch.toLowerCase();
    return sales.filter(s => 
      s.customer_name.toLowerCase().includes(search) ||
      s.phone_number.includes(search) ||
      s.nid_number.includes(search)
    );
  }, [sales, saleSearch]);

  const monthlyReportStats = useMemo(() => {
    const reportSales = sales.filter(s => {
      const date = format(parseISO(s.sale_date), 'yyyy-MM-dd');
      return date >= reportStartDate && date <= reportEndDate;
    });
    const totalProfit = reportSales.reduce((acc, s) => acc + calculateDynamicProfit(s), 0);
    const totalSales = reportSales.length;

    return { totalSales, totalProfit, reportSales };
  }, [sales, reportStartDate, reportEndDate, calculateDynamicProfit]);

  const mobileBazarPreview = useMemo(() => {
    const sale = sales.find(s => s.id === newMobileBazar.sale_id);
    if (!sale || !newMobileBazar.down_payment) return null;
    const profit = calculateDynamicProfit(sale);
    const downPayment = Number(newMobileBazar.down_payment);
    const net = downPayment - profit;
    return { profit, downPayment, net };
  }, [newMobileBazar, sales, calculateDynamicProfit]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md text-center"
        >
          <LogoBranding fileId={logoFileId} className="w-20 h-20 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mehedy Telecom</h1>
          <p className="text-gray-500 mb-8">Manage your inventory and sales efficiently</p>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-3"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <RestrictedAccess user={user} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 h-20 sm:h-28 overflow-hidden shadow-md">
        <BannerBranding fileId={bannerFileId} />
        
        {/* Action Buttons & User Info - Top Right */}
        <div className="absolute top-1 right-1 sm:top-2 sm:right-4 z-20 flex items-center gap-1 sm:gap-3">
          <div className="hidden lg:flex flex-col items-end mr-1">
            <span className="text-[8px] font-black text-gray-900 uppercase tracking-wider bg-white/20 px-1 rounded">{user.displayName}</span>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 sm:p-2 bg-white/40 hover:bg-white backdrop-blur-md rounded-full shadow-sm border border-white/40 transition-all text-gray-800 hover:text-blue-600"
            title="Shop Settings"
          >
            <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button 
            onClick={handleLogout} 
            className="p-1.5 sm:p-2 bg-white/40 hover:bg-red-50 backdrop-blur-md rounded-full shadow-sm border border-white/40 transition-all group"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-800 group-hover:text-red-600" />
          </button>
        </div>

        {/* Brand Elements - Logo and Name Stacked */}
        <div className="relative z-10 px-3 sm:px-6 pt-1.5 sm:pt-3 flex flex-col items-start gap-1">
          <LogoBranding 
            fileId={logoFileId} 
            className="w-8 h-8 sm:w-12 sm:h-12 shadow-md rounded-lg border border-white/40" 
          />
          <h1 className="text-[10px] sm:text-sm font-black text-gray-900 tracking-tighter drop-shadow-md uppercase -ml-1">
            Mehedy Telecom
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {/* Summary Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 mb-8">
            <div className="flex flex-col gap-3 sm:gap-4">
              <button 
                onClick={() => {
                  setNewProduct({ id: '', name: '', purchase_price: '', selling_price: '', quantity: '', ram: '', rom: '', image: null, image_file_id: '' });
                  setIsAddProductOpen(true);
                }}
                className="flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-100"
              >
                <Plus className="w-5 h-5" /> Add Product
              </button>
              
              <button 
                onClick={() => setIsSaleProductOpen(true)}
                className="flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-100"
              >
                <ShoppingCart className="w-5 h-5" /> Sale Product
              </button>
              <button 
                onClick={() => setIsSaleListOpen(true)}
                className="flex items-center justify-center gap-2 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-100"
              >
                <List className="w-5 h-5" /> Sale List
              </button>
              <button 
                onClick={() => setIsCashSaleOpen(true)}
                className="flex items-center justify-center gap-2 py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-100"
              >
                <CreditCard className="w-5 h-5" /> Cash Sale
              </button>
              <button 
                onClick={() => setIsMonthlyReportOpen(true)}
                className="flex items-center justify-center gap-2 py-4 bg-gray-800 hover:bg-black text-white font-bold rounded-xl transition-all shadow-lg shadow-gray-200"
              >
                <BarChart3 className="w-5 h-5" /> Monthly Report
              </button>
              <button 
                onClick={() => setIsMobileBazarOpen(true)}
                className="flex items-center justify-center gap-2 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-200"
              >
                <ArrowDownCircle className="w-5 h-5" /> Mobile Bazar
              </button>
            </div>

            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <SummaryItem 
                icon={Package} 
                label="Total Items" 
                value={stats.totalProducts} 
                colorClass="bg-indigo-500" 
              />
              <SummaryItem 
                icon={ShoppingCart} 
                label="Total Quantity" 
                value={stats.totalQuantity} 
                suffix=" Pcs"
                colorClass="bg-blue-600" 
              />
              <SummaryItem 
                symbol="৳" 
                label="Total Stock" 
                value={stats.totalStockValue} 
                prefix="৳"
                colorClass="bg-blue-500" 
              />
              <SummaryItem 
                icon={Calendar} 
                label="Today Sale" 
                value={stats.todayCount} 
                colorClass="bg-blue-500" 
              />
              <SummaryItem 
                symbol="৳" 
                label="Today Profit" 
                value={stats.todayProfit} 
                prefix="৳"
                colorClass="bg-emerald-500" 
              />
              <SummaryItem 
                icon={TrendingUp} 
                label="Monthly Sale" 
                value={stats.monthlyCount} 
                colorClass="bg-purple-500" 
              />
              <SummaryItem 
                symbol="৳" 
                label="Monthly Total Sale" 
                value={stats.monthlyTotalSale} 
                prefix="৳"
                colorClass="bg-emerald-600" 
              />
              <SummaryItem 
                symbol="৳" 
                label="Monthly Profit" 
                value={stats.monthlyProfit} 
                prefix="৳"
                colorClass="bg-orange-500" 
              />
              <SummaryItem 
                symbol="৳" 
                label="Mobile Bazar" 
                value={stats.mobileBazarTotal} 
                prefix="৳"
                colorClass="bg-blue-600" 
              />
            </div>
          </div>
        </div>

        <div className="h-px bg-gray-200 mb-8" />

        {/* Current Month Sales Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
              Monthly Sales List ({format(new Date(), 'MMMM')})
            </h2>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold border border-blue-100">
                Count: {currentMonthSales.length}
              </div>
              <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold border border-emerald-100">
                Total: ৳{currentMonthTotal.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-[10px] sm:text-xs font-black uppercase tracking-widest sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4">Model Number</th>
                  <th className="px-6 py-4 text-right">Selling Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentMonthSales.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Clock className="w-8 h-8 text-gray-300" />
                        <p className="text-gray-400 italic">No sales recorded this month yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentMonthSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {sale.product_name}
                          {(sale.ram || sale.rom) && (
                            <span className="ml-2 text-[10px] font-medium text-gray-500 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">
                              {sale.ram}/{sale.rom}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {format(parseISO(sale.sale_date), 'dd MMM')}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {format(parseISO(sale.sale_date), 'hh:mm a')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-black text-emerald-600 text-lg">
                          ৳{(sale.actual_sale_price || products.find(p => p.id === sale.product_id)?.selling_price || 0).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="h-px bg-gray-200 mb-8" />

        {/* Product Stock List */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-600" />
              Product Stock List
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-[10px] sm:text-xs font-black uppercase tracking-widest">
                <tr>
                  <th className="px-4 sm:px-6 py-4">Product Name</th>
                  <th className="px-4 sm:px-6 py-4">Variant</th>
                  <th className="px-4 sm:px-6 py-4">Date Added</th>
                  <th className="px-4 sm:px-6 py-4">Purchase</th>
                  <th className="px-4 sm:px-6 py-4">Selling</th>
                  <th className="px-4 sm:px-6 py-4">Profit/Pcs</th>
                  <th className="px-4 sm:px-6 py-4">Stock</th>
                  <th className="px-4 sm:px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                          {product.image_file_id ? (
                            <TelegramImage fileId={product.image_file_id} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-gray-900">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-gray-500 text-sm">
                      {product.ram && product.rom ? `${product.ram}/${product.rom}` : '-'}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-gray-400 text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {product.created_at ? format(parseISO(product.created_at), 'dd MMM yyyy') : 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-gray-600 font-medium">৳{product.purchase_price}</td>
                    <td className="px-4 sm:px-6 py-4 text-gray-600">৳{product.selling_price}</td>
                    <td className="px-4 sm:px-6 py-4 text-emerald-600 font-bold">৳{product.profit_margin}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-bold ${
                        product.quantity > 10 ? 'bg-emerald-100 text-emerald-700' : 
                        product.quantity > 0 ? 'bg-orange-100 text-orange-700' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {product.quantity} Pcs
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => {
                            setNewProduct({
                              id: product.id,
                              name: product.name,
                              purchase_price: String(product.purchase_price),
                              selling_price: String(product.selling_price),
                              quantity: '0',
                              ram: product.ram || '',
                              rom: product.rom || '',
                              image: null,
                              image_file_id: product.image_file_id || ''
                            });
                            setIsAddProductOpen(true);
                          }}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                          title="Edit / Restock"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-100">
                <tr>
                  <td colSpan={3} className="px-4 sm:px-6 py-4 font-black text-gray-900 uppercase tracking-wider">Total Stock Summary</td>
                  <td className="px-4 sm:px-6 py-4 font-black text-blue-600">৳<Counter value={stats.totalStockValue} /></td>
                  <td colSpan={2}></td>
                  <td colSpan={2} className="px-4 sm:px-6 py-4 font-black text-gray-900">
                    <Counter value={products.reduce((acc, p) => acc + p.quantity, 0)} suffix=" Pcs Total" />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </main>

      <Modal 
        isOpen={isAddProductOpen} 
        onClose={() => setIsAddProductOpen(false)} 
        title={newProduct.id ? "Update Existing Product" : "Add New Product"}
      >
        <form onSubmit={handleAddProduct} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Select Existing Product (Optional)</label>
            <select 
              value={newProduct.id}
              onChange={e => {
                const id = e.target.value;
                if (id) {
                  const p = products.find(prod => prod.id === id);
                  if (p) {
                    setNewProduct({
                      id: p.id,
                      name: p.name,
                      purchase_price: String(p.purchase_price),
                      selling_price: String(p.selling_price),
                      quantity: '', // Reset quantity for restock
                      ram: p.ram || '',
                      rom: p.rom || '',
                      image: null,
                      image_file_id: p.image_file_id || ''
                    });
                  }
                } else {
                  setNewProduct({ id: '', name: '', purchase_price: '', selling_price: '', quantity: '', ram: '', rom: '', image: null, image_file_id: '' });
                }
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">-- Create New Product --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} {p.ram ? `(${p.ram}/${p.rom})` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Product Name</label>
            <input 
              required
              type="text"
              value={newProduct.name}
              onChange={e => setNewProduct({...newProduct, name: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="e.g. iPhone 15 Pro"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Product Image</label>
            <div className="flex items-center gap-4">
              {newProduct.image_file_id && !newProduct.image && (
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200">
                  <TelegramImage fileId={newProduct.image_file_id} />
                </div>
              )}
              {newProduct.image && (
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200">
                  <img src={URL.createObjectURL(newProduct.image)} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1">
                <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 text-gray-500">
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-xs font-bold">{newProduct.image ? newProduct.image.name : "Choose Image"}</span>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) setNewProduct({...newProduct, image: file});
                    }}
                  />
                </label>
                {uploadProgress['product_image'] !== undefined && (
                  <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${uploadProgress['product_image']}%` }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">RAM</label>
              <input 
                type="text"
                value={newProduct.ram}
                onChange={e => setNewProduct({...newProduct, ram: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. 8GB"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">ROM</label>
              <input 
                type="text"
                value={newProduct.rom}
                onChange={e => setNewProduct({...newProduct, rom: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. 256GB"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Purchase Price</label>
              <input 
                required
                type="number"
                value={newProduct.purchase_price}
                onChange={e => setNewProduct({...newProduct, purchase_price: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Selling Price</label>
              <input 
                required
                type="number"
                value={newProduct.selling_price}
                onChange={e => setNewProduct({...newProduct, selling_price: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-emerald-800">Estimated Profit Margin</span>
              <span className="text-lg font-black text-emerald-600">
                ৳{Math.max(0, Number(newProduct.selling_price || 0) - Number(newProduct.purchase_price || 0))}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              {newProduct.id ? "Stock Adjustment (use - to decrease)" : "Initial Quantity (Stock)"}
            </label>
            <input 
              required
              type="number"
              value={newProduct.quantity}
              onChange={e => setNewProduct({...newProduct, quantity: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder={newProduct.id ? "e.g. 10 or -5" : "0"}
            />
          </div>
          <button 
            disabled={isSubmitting}
            type="submit"
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> {newProduct.id ? "Update Product" : "Confirm Add Product"}</>}
          </button>
        </form>
      </Modal>

      {/* Sale Product Modal */}
      <Modal 
        isOpen={isSaleProductOpen} 
        onClose={() => setIsSaleProductOpen(false)} 
        title="Record New Sale"
      >
        <form onSubmit={handleSaleProduct} className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Customer Information</h3>
              <div className="w-1/2">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Sale Date & Time</label>
                <input 
                  required
                  type="datetime-local"
                  value={newSale.sale_date}
                  onChange={e => setNewSale({...newSale, sale_date: e.target.value})}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Customer Name</label>
                <input 
                  required
                  type="text"
                  value={newSale.customer_name}
                  onChange={e => setNewSale({...newSale, customer_name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Phone Number (Bkash)</label>
                <input 
                  required
                  type="tel"
                  value={newSale.phone_number}
                  onChange={e => setNewSale({...newSale, phone_number: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">NID Number</label>
                <input 
                  required
                  type="text"
                  value={newSale.nid_number}
                  onChange={e => setNewSale({...newSale, nid_number: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Guarantor Phone</label>
                <input 
                  type="tel"
                  value={newSale.guarantor_number}
                  onChange={e => setNewSale({...newSale, guarantor_number: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Full Address</label>
              <textarea 
                required
                value={newSale.address}
                onChange={e => setNewSale({...newSale, address: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Product Selection</h3>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Select Product</label>
              <select 
                required
                value={newSale.product_id}
                onChange={e => setNewSale({...newSale, product_id: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">Choose a product...</option>
                {products.filter(p => p.quantity > 0).map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.ram ? `(${p.ram}/${p.rom})` : ''} - Stock: {p.quantity}</option>
                ))}
              </select>
              {newSale.product_id && (
                <div className="mt-4 flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-gray-200 flex-shrink-0">
                    {products.find(p => p.id === newSale.product_id)?.image_file_id ? (
                      <TelegramImage fileId={products.find(p => p.id === newSale.product_id)!.image_file_id!} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{products.find(p => p.id === newSale.product_id)?.name}</p>
                    <p className="text-xs text-gray-500">
                      {products.find(p => p.id === newSale.product_id)?.ram}/{products.find(p => p.id === newSale.product_id)?.rom}
                    </p>
                    <p className="text-sm font-black text-blue-600 mt-1">৳{products.find(p => p.id === newSale.product_id)?.selling_price.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Image Upload (Telegram)</h3>
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer relative">
              <input 
                type="file" 
                multiple 
                accept="image/*"
                onChange={e => {
                  if (e.target.files) {
                    setNewSale({...newSale, images: Array.from(e.target.files)});
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <ImageIcon className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-600">Click to upload images</p>
              <p className="text-xs text-gray-400">Minimum 1 image required</p>
              {newSale.images.length > 0 && (
                <div className="mt-4 space-y-2">
                  {newSale.images.map((f, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs font-bold text-gray-600">
                        <span>{f.name}</span>
                        <span>{uploadProgress[f.name] || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full transition-all duration-300"
                          style={{ width: `${uploadProgress[f.name] || 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button 
            disabled={isSubmitting}
            type="submit"
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShoppingCart className="w-5 h-5" /> Confirm Sale</>}
          </button>
        </form>
      </Modal>

      {/* Cash Sale Modal */}
      <Modal 
        isOpen={isCashSaleOpen} 
        onClose={() => setIsCashSaleOpen(false)} 
        title="Quick Cash Sale"
      >
        <form onSubmit={handleCashSale} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">Select Product</label>
              <select 
                required
                value={cashSale.product_id}
                onChange={e => setCashSale({...cashSale, product_id: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">Choose a product...</option>
                {products.filter(p => p.quantity > 0).map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.ram ? `(${p.ram}/${p.rom})` : ''} - Stock: {p.quantity}</option>
                ))}
              </select>
            </div>
            <div className="w-1/2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Sale Date</label>
              <input 
                required
                type="datetime-local"
                value={cashSale.sale_date}
                onChange={e => setCashSale({...cashSale, sale_date: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          {cashSale.product_id && (
              <div className="mt-4 flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-gray-200 flex-shrink-0">
                  {products.find(p => p.id === cashSale.product_id)?.image_file_id ? (
                    <TelegramImage fileId={products.find(p => p.id === cashSale.product_id)!.image_file_id!} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{products.find(p => p.id === cashSale.product_id)?.name}</p>
                  <p className="text-xs text-gray-500">
                    {products.find(p => p.id === cashSale.product_id)?.ram}/{products.find(p => p.id === cashSale.product_id)?.rom}
                  </p>
                  <p className="text-sm font-black text-blue-600 mt-1">৳{products.find(p => p.id === cashSale.product_id)?.selling_price.toLocaleString()}</p>
                </div>
              </div>
            )}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Actual Sale Price (৳)</label>
            <input 
              required
              type="number"
              value={cashSale.actual_sale_price}
              onChange={e => setCashSale({...cashSale, actual_sale_price: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter amount customer paid"
            />
          </div>
          {cashSale.product_id && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-emerald-800">Calculated Profit</span>
                <span className="text-lg font-black text-emerald-600">
                  ৳{Math.max(0, Number(cashSale.actual_sale_price || 0) - (products.find(p => p.id === cashSale.product_id)?.purchase_price || 0))}
                </span>
              </div>
            </div>
          )}
          <button 
            disabled={isSubmitting}
            type="submit"
            className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CreditCard className="w-5 h-5" /> Complete Cash Sale</>}
          </button>
        </form>
      </Modal>

      {/* Monthly Report Modal */}
      <Modal 
        isOpen={isMonthlyReportOpen} 
        onClose={() => setIsMonthlyReportOpen(false)} 
        title="Monthly Sales Report"
      >
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex-1 w-full">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">From Date</label>
              <input 
                type="date"
                value={reportStartDate}
                onChange={e => setReportStartDate(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">To Date</label>
              <input 
                type="date"
                value={reportEndDate}
                onChange={e => setReportEndDate(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 text-center">
              <p className="text-xs font-black text-blue-400 uppercase mb-1">Total Sales</p>
              <p className="text-3xl font-black text-blue-600">{monthlyReportStats.totalSales}</p>
            </div>
            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
              <p className="text-xs font-black text-emerald-400 uppercase mb-1">Total Profit</p>
              <p className="text-3xl font-black text-emerald-600">৳{monthlyReportStats.totalProfit}</p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Sales in this month</h3>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {monthlyReportStats.reportSales.map(s => (
                <div key={s.id} className="p-3 bg-gray-50 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{s.customer_name}</p>
                    <p className="text-[10px] text-gray-500">
                      {s.product_name} {(s.ram || s.rom) ? `(${s.ram || ''}${s.ram && s.rom ? '/' : ''}${s.rom || ''})` : ''}
                    </p>
                    <p className="text-[10px] text-gray-400">{format(parseISO(s.sale_date), 'dd/MM/yyyy')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600 text-sm">
                      ৳{(s.actual_sale_price || products.find(p => p.id === s.product_id)?.selling_price || 0).toLocaleString()}
                    </p>
                    <p className="text-[9px] text-orange-500 font-bold">Profit: ৳{calculateDynamicProfit(s).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Mobile Bazar Modal */}
      <Modal 
        isOpen={isMobileBazarOpen} 
        onClose={() => setIsMobileBazarOpen(false)} 
        title="Mobile Bazar - Add Hisab"
      >
        <div className="space-y-6">
          <form onSubmit={handleMobileBazarSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Select Sale Record</label>
              <select 
                required
                value={newMobileBazar.sale_id}
                onChange={e => setNewMobileBazar({...newMobileBazar, sale_id: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">Choose a sale record...</option>
                {sales.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.customer_name} - {s.product_name} {(s.ram || s.rom) ? `(${s.ram || ''}${s.ram && s.rom ? '/' : ''}${s.rom || ''})` : ''} ({format(parseISO(s.sale_date), 'MMM dd')})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Down Payment (৳)</label>
              <input 
                required
                type="number"
                value={newMobileBazar.down_payment}
                onChange={e => setNewMobileBazar({...newMobileBazar, down_payment: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter down payment amount"
              />
            </div>

            {mobileBazarPreview && (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Down Payment:</span>
                  <span className="font-bold">৳{mobileBazarPreview.down_payment}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sale Profit Margin:</span>
                  <span className="font-bold text-red-500">- ৳{mobileBazarPreview.profit}</span>
                </div>
                <div className="h-px bg-blue-200 my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-blue-800">Net Amount:</span>
                  <span className="text-lg font-black text-blue-600">৳{mobileBazarPreview.net}</span>
                </div>
              </div>
            )}

            <button 
              disabled={isSubmitting}
              type="submit"
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Add Hisab"}
            </button>
          </form>

          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-end mb-2">
              <div>
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Recent Hisab</h3>
                <button 
                  onClick={handleResetMobileBazar}
                  disabled={isSubmitting || mobileBazarRecords.length === 0}
                  className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase mt-1 flex items-center gap-1 disabled:opacity-30"
                >
                  <Trash2 className="w-3 h-3" /> Reset All Records
                </button>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase">Total Mobile Bazar</p>
                <p className="text-xl font-black text-blue-600">৳{stats.mobileBazarTotal}</p>
              </div>
            </div>
            <div className="max-h-[250px] overflow-y-auto space-y-2">
              {mobileBazarRecords.map(r => {
                const sale = sales.find(s => s.id === r.sale_id);
                const dynamicProfit = sale ? calculateDynamicProfit(sale) : r.sale_profit;
                const dynamicNetAmount = sale ? (r.down_payment - dynamicProfit) : r.net_amount;
                
                return (
                  <div key={r.id} className="p-3 bg-gray-50 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{r.customer_name}</p>
                      <p className="text-xs text-gray-500">
                        {r.product_name} {(r.ram || r.rom) ? `(${r.ram || ''}${r.ram && r.rom ? '/' : ''}${r.rom || ''})` : ''}
                      </p>
                      <p className="text-[10px] text-gray-400">{format(parseISO(r.created_at), 'dd/MM/yyyy - hh:mm a')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">৳{dynamicNetAmount}</p>
                      <p className="text-[10px] text-gray-400">DP: ৳{r.down_payment} | Profit: ৳{dynamicProfit}</p>
                    </div>
                  </div>
                );
              })}
              {mobileBazarRecords.length === 0 && (
                <p className="text-center py-4 text-gray-400 text-sm">No records yet.</p>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Sale List Modal */}
      <Modal 
        isOpen={isSaleListOpen} 
        onClose={() => setIsSaleListOpen(false)} 
        title="All Sales History"
      >
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text"
              value={saleSearch}
              onChange={e => setSaleSearch(e.target.value)}
              placeholder="Search by name, phone, or NID..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="space-y-3">
            {filteredSales.map((sale) => (
              <button 
                key={sale.id}
                onClick={() => setSelectedSale(sale)}
                className="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-blue-200 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4">
                  <CustomerAvatar fileId={sale.image_file_ids?.[0]} />
                  <div className="text-left">
                    <h4 className="font-bold text-gray-900">{sale.customer_name}</h4>
                    <p className="text-sm text-gray-500">{sale.phone_number}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {sale.product_name} {(sale.ram || sale.rom) ? `(${sale.ram || ''}${sale.ram && sale.rom ? '/' : ''}${sale.rom || ''})` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-600">
                      ৳{(sale.actual_sale_price || products.find(p => p.id === sale.product_id)?.selling_price || 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-500 font-medium">
                      {format(parseISO(sale.sale_date), 'dd/MM/yyyy')}
                    </p>
                    <p className="text-[9px] text-gray-400">
                      {format(parseISO(sale.sale_date), 'hh:mm a')}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </button>
            ))}
            {filteredSales.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No sales records found.
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Sale Details Modal */}
      <Modal 
        isOpen={!!selectedSale} 
        onClose={() => setSelectedSale(null)} 
        title="Sale Details"
      >
        {selectedSale && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CustomerAvatar fileId={selectedSale.image_file_ids?.[0]} />
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Customer Details</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Full Name</p>
                      <p className="font-bold text-gray-900">{selectedSale.customer_name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Phone Number</p>
                      <p className="font-bold text-gray-900">{selectedSale.phone_number}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">NID Number</p>
                      <p className="font-bold text-gray-900">{selectedSale.nid_number}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Address</p>
                      <p className="font-bold text-gray-900">{selectedSale.address}</p>
                    </div>
                  </div>
                  {selectedSale.guarantor_number && (
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-blue-500 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500">Guarantor Phone</p>
                        <p className="font-bold text-gray-900">{selectedSale.guarantor_number}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Transaction Details</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 text-emerald-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Product Sold</p>
                      <p className="font-bold text-gray-900">
                        {selectedSale.product_name} {(selectedSale.ram || selectedSale.rom) ? `(${selectedSale.ram || ''}${selectedSale.ram && selectedSale.rom ? '/' : ''}${selectedSale.rom || ''})` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-emerald-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Selling Price</p>
                      <p className="font-black text-emerald-600 text-lg">
                        ৳{(selectedSale.actual_sale_price || products.find(p => p.id === selectedSale.product_id)?.selling_price || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-orange-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Profit Earned</p>
                      <p className="font-bold text-orange-600">৳{calculateDynamicProfit(selectedSale).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-emerald-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Sale Date & Time</p>
                      <p className="font-bold text-gray-900">{format(parseISO(selectedSale.sale_date), 'dd/MM/yyyy - hh:mm a')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Uploaded Images (Telegram)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {selectedSale.image_file_ids.map((fileId: string, idx: number) => (
                  <TelegramImage key={idx} fileId={fileId} />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setEditingSale(selectedSale)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 transition-colors"
              >
                <Edit2 className="w-4 h-4" /> Edit Sale
              </button>
              <button 
                onClick={() => setSelectedSale(null)}
                className="px-4 py-2 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Sale Modal */}
      <Modal 
        isOpen={!!editingSale} 
        onClose={() => {
          setEditingSale(null);
          setEditSaleImages([]);
        }} 
        title="Edit Sale Record"
      >
        {editingSale && (
          <form onSubmit={handleEditSale} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Customer Name</label>
              <input 
                required
                type="text"
                value={editingSale.customer_name}
                onChange={e => setEditingSale({...editingSale, customer_name: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Phone</label>
                <input 
                  required
                  type="tel"
                  value={editingSale.phone_number}
                  onChange={e => setEditingSale({...editingSale, phone_number: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">NID</label>
                <input 
                  required
                  type="text"
                  value={editingSale.nid_number}
                  onChange={e => setEditingSale({...editingSale, nid_number: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Selling Price (৳)</label>
                <input 
                  required
                  type="number"
                  value={editingSale.actual_sale_price || ''}
                  onChange={e => setEditingSale({...editingSale, actual_sale_price: Number(e.target.value)})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Profit (৳)</label>
                <input 
                  required
                  type="number"
                  value={editingSale.profit}
                  onChange={e => setEditingSale({...editingSale, profit: Number(e.target.value)})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Update Images</h3>
              
              {/* Existing Images */}
              <div className="grid grid-cols-3 gap-2">
                {editingSale.image_file_ids.map((fileId, idx) => (
                  <div key={idx} className="relative group">
                    <TelegramImage fileId={fileId} />
                    <button
                      type="button"
                      onClick={() => {
                        const newIds = editingSale.image_file_ids.filter((_, i) => i !== idx);
                        setEditingSale({...editingSale, image_file_ids: newIds});
                      }}
                      className="absolute -top-1 -right-1 bg-red-500 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Upload New */}
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-blue-400 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  multiple 
                  accept="image/*"
                  onChange={e => {
                    if (e.target.files) {
                      setEditSaleImages(Array.from(e.target.files));
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-600">Add more images</p>
                {editSaleImages.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {editSaleImages.map((f, i) => (
                      <div key={i} className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] font-bold text-gray-600">
                          <span className="truncate max-w-[150px]">{f.name}</span>
                          <span>{uploadProgress[f.name] || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                          <div 
                            className="bg-blue-600 h-full transition-all duration-300"
                            style={{ width: `${uploadProgress[f.name] || 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button 
              disabled={isSubmitting}
              type="submit"
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
            </button>
          </form>
        )}
      </Modal>

      {/* Shop Settings Modal */}
      <Modal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        title="Shop Settings"
      >
        <div className="space-y-8">
          {/* Logo Section */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3">Shop Logo / Profile Picture</h3>
            <div className="flex items-center gap-6">
              <LogoBranding fileId={logoFileId} className="w-24 h-24" />
              {isSuperAdmin ? (
                <div className="flex-1 space-y-3">
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpdateLogo(file);
                      }}
                      className="hidden" 
                      id="logo-upload"
                      disabled={isSubmitting}
                    />
                    <label 
                      htmlFor="logo-upload"
                      className="flex items-center justify-center gap-2 w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-xl border border-blue-100 cursor-pointer transition-all"
                    >
                      {isSubmitting && uploadProgress['logo'] ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs">{uploadProgress['logo']}%</span>
                        </div>
                      ) : (
                        <>
                          <User className="w-4 h-4" />
                          {logoFileId ? "Change Logo" : "Upload Logo"}
                        </>
                      )}
                    </label>
                  </div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-relaxed">
                    This logo will appear next to your shop name in the header and on the login screen.
                  </p>
                </div>
              ) : (
                <div className="flex-1">
                  <p className="text-sm text-gray-500 italic">Only the shop owner can change the logo.</p>
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Banner Section */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3">Shop Branding Banner</h3>
            <div className="space-y-4">
              <div className="w-full relative h-24 rounded-xl overflow-hidden border border-gray-100 shadow-inner">
                <BannerBranding fileId={bannerFileId} />
              </div>
              {isSuperAdmin ? (
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpdateBanner(file);
                    }}
                    className="hidden" 
                    id="banner-upload"
                    disabled={isSubmitting}
                  />
                  <label 
                    htmlFor="banner-upload"
                    className="flex items-center justify-center gap-2 w-full py-4 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold rounded-xl border-2 border-dashed border-gray-200 cursor-pointer transition-all"
                  >
                    {isSubmitting && uploadProgress['banner'] ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                        <span className="text-xs text-blue-600">{uploadProgress['banner']}%</span>
                      </div>
                    ) : (
                      <>
                        <ImageIcon className="w-5 h-5" />
                        {bannerFileId ? "Change Banner" : "Upload Banner"}
                      </>
                    )}
                  </label>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic text-center">Only the shop owner can change the banner.</p>
              )}
              <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest">
                This banner will be displayed in the header branding area.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
