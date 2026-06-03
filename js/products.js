// js/products.js

// دالة موحدة لإنشاء تصميم الكرت للمنتجات
function createProductCardHTML(data, options = {}) {
    const showControls = options.showControls || false;
    const isAdmin = options.isAdmin || false;
    // تأكد من أن `data.id` موجود لتوليد رابط صحيح
    const productId = data.id || ''; 
    const productTitle = data.product_name || 'منتج غير معروف';
    // استخدام getSafeImageUrl لضمان ظهور الصور المخزنة في قاعدة البيانات
    const productImage = typeof getSafeImageUrl === 'function' ? getSafeImageUrl(data.main_image) : (data.main_image || 'imges/placeholder.png');
    const productDesc = data.short_description || '';
    const productCategory = data.category_name || '';
    const productStatus = data.status || 'active';

    return `
        <div class="project-card">
            <div class="card-image">
                <a href="view.html?id=${productId}">
                    <img src="${productImage}" alt="${productTitle}">
                </a>
            </div>
            <div class="card-content">
                <a href="view.html?id=${productId}" style="text-decoration: none; color: inherit;">
                    <h3 class="card-title">${productTitle}</h3>
                </a>
                <p class="card-description" style="font-size: 14px; color: #666; margin: 10px 0;">
                    ${productDesc.substring(0, 70)}${productDesc.length > 70 ? '...' : ''}
                </p>
                <div class="card-meta">
                    <span class="category" style="font-weight: bold; text-transform: uppercase; font-size: 12px;">${productCategory}</span>
                </div>
                ${showControls ? `
                <div class="card-actions" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px; display: flex; gap: 10px;">
                    ${isAdmin ? (
                        productStatus === 'pending_admin_approval' ? `
                            <button onclick="approveProduct(${productId})" style="flex: 1; background: #5cb85c; color: #fff; border: none; padding: 5px; border-radius: 4px; cursor: pointer; font-size: 12px;">قبول</button>
                            <button onclick="rejectProduct(${productId})" style="flex: 1; background: #d9534f; color: #fff; border: none; padding: 5px; border-radius: 4px; cursor: pointer; font-size: 12px;">رفض</button>
                        ` : `
                            <button onclick="suspendProduct(${productId})" style=" background: #ff0000; color: #fff; border: none; padding: 5px; border-radius: 4px; cursor: pointer; font-size: 13px;">Stop</button>
                        `
                    ) : `
                        <a href="edit-product.html?id=${productId}" class="edit-btn" style="flex: 1; text-align: center; background: gray; color: #fff; padding: 5px; border-radius: 4px; text-decoration: none; font-size: 13px;">Edit</a>
                        <button onclick="deleteProduct(${productId})" style="flex: 1; background: #d9534f; color: #fff; border: none; padding: 5px; border-radius: 4px; cursor: pointer; font-size: 13px;">Delete</button>
                    `}
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

// دالة لجلب وعرض المنتجات من الـ API
async function loadProducts(containerId, limit = null, brandId = null, showControls = false) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID '${containerId}' not found.`);
        return;
    }

    // إذا لم يمرر ID البراند، نحاول جلبها من الرابط (لصفحات العرض الخاصة بالبراند)
    if (!brandId) {
        const urlParams = new URLSearchParams(window.location.search);
        brandId = urlParams.get('brand') || urlParams.get('brand_id');
    }

    // التحقق من حالة المدير محلياً لتفعيل أدوات التحكم تلقائياً
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const isAdmin = userData.account_type === 'admin' || userData.role === 'admin';

    try {
        // بناء الرابط مع فلتر البراند إن وجد
        let url = '/products/public-list.php';
        if (brandId) {
            url += `?brand_id=${brandId}`;
        }
        
        const result = await FancyAPI.get(url); 

        if (result.status === 401) {
            container.innerHTML = `<p style="text-align: center; grid-column: 1/-1; padding: 40px;">يرجى <a href="#" class="login-link">تسجيل الدخول</a> لعرض المنتجات المتاحة.</p>`;
            if (window.showAuthModal) window.showAuthModal('login');
            return;
        }

        if (result && result.success && Array.isArray(result.data.products)) {
            let productsToDisplay = result.data.products;
            if (limit !== null) {
                productsToDisplay = productsToDisplay.slice(0, limit);
            }

            if (productsToDisplay.length === 0) {
                container.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">لا توجد منتجات متاحة حالياً.</p>';
                return;
            }

            // استخدام string buffer لتحسين الأداء وتجنب مشاكل الرندر
            const finalShowControls = showControls || isAdmin;
            const htmlContent = productsToDisplay.map(product => createProductCardHTML(product, { showControls: finalShowControls, isAdmin })).join('');
            container.innerHTML = htmlContent;
        } else {
            const detail = result.status === 404 ? 'الملف list.php غير موجود في هذا المسار' : (result.message || 'خطأ غير معروف');
            console.error('Failed to load products:', detail, `Status: ${result.status}`);
            container.innerHTML = `<p style="text-align: center; color: red;">فشل تحميل المنتجات: ${detail}</p>`;
        }
    } catch (error) {
        console.error('Error fetching products:', error);
        container.innerHTML = `<p style="text-align: center; color: red;">حدث خطأ في الاتصال بالخادم لتحميل المنتجات.</p>`;
    }
}

// دالة لجلب وعرض تفاصيل منتج واحد من الـ API (لصفحة view.html)
async function loadSingleProductDetails(productId) {
    if (!productId) {
        console.error('Product ID is required to load a single product.');
        window.location.href = "index.html"; // إعادة التوجيه للصفحة الرئيسية إذا لم يتوفر ID
        return;
    }

    try {
        // افتراض وجود API endpoint لجلب منتج واحد
        const result = await FancyAPI.get(`/products/view.php?id=${productId}`); 

        if (result && result.success && result.data.product) {
            const product = result.data.product;
            // استخدام getSafeImageUrl لتصحيح مسار الصورة وتجنب 404
            document.getElementById('project-image').src = typeof getSafeImageUrl === 'function' ? getSafeImageUrl(product.main_image) : (product.main_image || 'imges/placeholder.png');
            document.getElementById('project-name').innerText = product.product_name || 'منتج غير معروف';
            document.getElementById('project-desc').innerText = product.description || 'لا يوجد وصف لهذا المنتج.';
            document.getElementById('project-category').innerText = product.category_name || "";

            // تحديث رابط الواتساب
            const whatsappBtn = document.getElementById('whatsapp-btn');
            if (whatsappBtn) {
                const message = encodeURIComponent(`السلام عليكم، أود الاستفسار عن تفاصيل وسعر: ${product.product_name}`);
                // يمكنك استبدال 'YOUR_DEFAULT_WHATSAPP_NUMBER' برقم واتساب افتراضي إذا لم يكن متوفراً في بيانات المنتج
                whatsappBtn.href = `https://wa.me/${product.whatsapp || '966500000000'}?text=${message}`; 
            }

            // هنا يمكنك إضافة منطق عرض الصور المصغرة (thumbnails) والألوان إذا كانت البيانات متوفرة في استجابة الـ API
            // حالياً، الكود في view.html يعتمد على `project.gallery` و `project.colors` من `data.js`
            // ستحتاج إلى تعديل الـ API ليعيد هذه البيانات أو تعديل الواجهة الأمامية لتعالجها بشكل مختلف.

        } else {
            const detail = result.status === 404 ? 'المنتج غير موجود أو الرابط خاطئ (404)' : result.message;
            console.error('Failed to load product details:', detail);
            alert(`خطأ: ${detail}`);
            window.location.href = "index.html";
        }
    } catch (error) {
        console.error('Error fetching single product:', error);
        window.location.href = "index.html"; // إعادة التوجيه للصفحة الرئيسية عند الخطأ
    }
}

// دالة لجلب وعرض منتجات المستخدم المسجل حالياً
async function loadMyProducts(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const result = await FancyAPI.get('/products/my-products.php');

        if (result.status === 401) {
            container.innerHTML = `<p style="text-align: center; color: #666; grid-column: 1/-1; padding: 40px;">يجب <a href="#" class="login-link">تسجيل الدخول</a> لإدارة منتجاتك.</p>`;
            if (window.showAuthModal) window.showAuthModal('login');
            return;
        }

        if (result && result.success && Array.isArray(result.data.products)) {
            container.innerHTML = ""; 
            
            if (result.data.products.length === 0) {
                container.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 40px;">You currently have no products. Start by adding your first product!</p>';
                return;
            }

            result.data.products.forEach(product => {
                container.innerHTML += createProductCardHTML(product, { showControls: true });
            });
        } else {
            const detail = result.status === 401 ? 'يجب تسجيل الدخول لعرض منتجاتك' : (result.message || 'خطأ غير معروف');
            console.error('Failed to load my products:', detail);
            container.innerHTML = `<p style="text-align: center; color: red; grid-column: 1/-1;">${detail}</p>`;
        }
    } catch (error) {
        console.error('Error fetching my products:', error);
        container.innerHTML = `<p style="text-align: center; color: red; grid-column: 1/-1;">حدث خطأ في الاتصال بالسيرفر.</p>`;
    }
}

// دالة لجلب بيانات المنتج ووضعها في نموذج التعديل
async function loadProductDataForEdit(productId) {
    try {
        // نستخدم get.php لأنه مخصص لصاحب المنتج ويجلب تفاصيل أكثر
        const result = await FancyAPI.get(`/products/get.php?product_id=${productId}`);

        if (result && result.success && result.data.product) {
            const product = result.data.product;
            const form = document.getElementById('editProductForm');
            if (!form) return;

            // تعبئة الحقول
            // التأكد من جلب المعرف بأي صيغة يعود بها من السيرفر
            form.elements['product_id'].value = product.id || product.product_id || '';
            form.elements['brand_id'].value = product.brand_id;
            form.elements['product_name'].value = product.product_name;
            form.elements['category_id'].value = product.category_id || '';
            // سيتم تعيين القسم الفرعي في ملف HTML بعد تحميل الخيارات ديناميكياً
            form.elements['short_description'].value = product.short_description || '';
            form.elements['description'].value = product.description || '';
        } else {
            alert("فشل في جلب بيانات المنتج: " + (result.message || "خطأ غير معروف"));
            window.location.href = 'my-products.html';
        }
    } catch (error) {
        console.error('Error loading product for edit:', error);
        alert("حدث خطأ أثناء تحميل البيانات.");
    }
}

// دالة إرسال التحديث إلى update.php
async function submitProductUpdate(formData) {
    // 1. تحويل الـ FormData إلى Object عادي
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    // 2. إرسال الطلب بتنسيق JSON
    try {
        const response = await fetch('/fancy-design/Fancy/api/products/update.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' // أخبر السيرفر أنك ترسل JSON
            },
            body: JSON.stringify(data) // تحويل الكائن إلى نص JSON
        });

        const result = await response.json();
        
        if (result.success) {
            alert('تم التحديث بنجاح!');
            // العودة إلى صفحة البروفايل بعد الضغط على موافق في رسالة التنبيه
            window.location.href = 'profile.html';
        } else {
            alert('فشل: ' + result.message);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function submitNewProduct(formData) {
    try {
        console.log("Sending product data...");
        
        // ملاحظة: لا تحول formData إلى JSON
        // إذا كان FancyAPI يضيف JSON Header تلقائياً، فقد تحتاج لاستخدام fetch العادي أو تعديل FancyAPI
        const response = await fetch('/fancy-design/Fancy/api/products/create.php', {
            method: 'POST',
            body: formData // أرسل الـ formData مباشرة
            // لا تضع Content-Type هنا، المتصفح سيضعها تلقائياً مع الـ boundary الصحيح
        });

        const result = await response.json();

        if (result.success) {
            alert("تم إضافة المنتج بنجاح!");
            window.location.href = 'index.html';
        } else {
            alert("خطأ: " + (result.message || "حدث خطأ"));
        }
    } catch (error) {
        console.error('Error:', error);
        alert("فشل الاتصال بالسيرفر.");
    }
}
// دالة لجلب وعرض المنتجات المعلقة (للمدير فقط)
async function loadPendingProductsForAdmin(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || (userData.account_type !== 'admin' && userData.role !== 'admin')) {
        container.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 40px; color: red;">ليس لديك صلاحية الوصول لهذه الصفحة.</p>';
        // يمكنك إعادة توجيه المستخدم لصفحة أخرى
        // window.location.href = 'index.html';
        return;
    }

    try {
        // استدعاء API جديد لجلب المنتجات المعلقة
        const result = await FancyAPI.get('/admin/pending-products.php');

        if (result && result.success && Array.isArray(result.data.products)) {
            container.innerHTML = ""; 
            
            if (result.data.products.length === 0) {
                container.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 40px;">لا توجد منتجات معلقة للمراجعة حالياً.</p>';
                return;
            }

            result.data.products.forEach(product => {
                container.innerHTML += createProductCardHTML(product, { showControls: true, isAdmin: true });
            });
        } else {
            const detail = result.status === 401 ? 'يجب تسجيل الدخول كمدير لعرض المنتجات المعلقة' : (result.message || 'خطأ غير معروف');
            console.error('Failed to load pending products:', detail);
            container.innerHTML = `<p style="text-align: center; color: red; grid-column: 1/-1;">${detail}</p>`;
        }
    } catch (error) {
        console.error('Error fetching pending products:', error);
        container.innerHTML = `<p style="text-align: center; color: red; grid-column: 1/-1;">حدث خطأ في الاتصال بالسيرفر.</p>`;
    }
}

// دالة قبول المنتج
async function approveProduct(id) {
    if (!confirm('هل تريد الموافقة على هذا المنتج؟')) return;
    const result = await FancyAPI.post('/admin/approve-product.php', { product_id: id });
    if (result.success) {
        alert('تم قبول المنتج بنجاح');
        loadPendingProductsForAdmin('pending-products-container');
    } else {
        alert('فشل القبول: ' + result.message);
    }
}

// دالة رفض المنتج
async function rejectProduct(id) {
    const reason = prompt('سبب الرفض:');
    if (reason === null) return;
    const result = await FancyAPI.post('/admin/reject-product.php', { product_id: id, reason: reason });
    if (result.success) {
        alert('تم رفض المنتج');
        loadPendingProductsForAdmin('pending-products-container');
    } else {
        alert('فشل الرفض: ' + result.message);
    }
}

// دالة إيقاف المنتج (للإدارة)
async function suspendProduct(id) {
    if (!confirm('هل تريد إيقاف هذا المنتج؟ سيختفي من العرض العام.')) return;
    const result = await FancyAPI.post('/admin/suspend-product.php', { product_id: id });
    if (result.success) {
        alert('تم إيقاف المنتج بنجاح');
        location.reload(); // تحديث الصفحة لرؤية التغييرات
    } else {
        alert('فشل الإيقاف: ' + result.message);
    }
}

// دالة حذف المنتج نهائياً
async function deleteProduct(id) {
    if (!confirm('تحذير: هل أنت متأكد من حذف هذا المنتج نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    try {
        // إرسال طلب الحذف إلى السيرفر
        const result = await FancyAPI.post('/products/delete.php', { product_id: id });
        if (result.success) {
            alert(result.message || 'تم حذف المنتج بنجاح');
            // إعادة تحميل الصفحة لتحديث القائمة
            location.reload();
        } else {
            alert('فشل الحذف: ' + (result.message || 'حدث خطأ غير معروف'));
        }
    } catch (error) {
        console.error('Delete product error:', error);
        alert('حدث خطأ أثناء محاولة الاتصال بالسيرفر لحذف المنتج.');
    }
}

// جعل الدوال متاحة عالمياً
window.createProductCardHTML = createProductCardHTML;
window.loadProducts = loadProducts;
window.loadSingleProductDetails = loadSingleProductDetails;
window.loadMyProducts = loadMyProducts;
window.loadProductDataForEdit = loadProductDataForEdit;
window.submitProductUpdate = submitProductUpdate;
window.submitNewProduct = submitNewProduct;
window.loadPendingProductsForAdmin = loadPendingProductsForAdmin;
window.approveProduct = approveProduct;
window.rejectProduct = rejectProduct;
window.suspendProduct = suspendProduct;
window.deleteProduct = deleteProduct;
