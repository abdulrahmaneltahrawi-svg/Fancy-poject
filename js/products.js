// js/products.js

// دالة موحدة لإنشاء تصميم الكرت للمنتجات
function createProductCardHTML(data, options = {}) {
    const showControls = options.showControls || false;
    const isAdmin = options.isAdmin || false;
    // تأكد من أن `data.id` موجود لتوليد رابط صحيح
    const productId = data.id || ''; 
    const productTitle = data.product_name || 'منتج غير معروف';
    const productImage = data.main_image || 'imges/placeholder.png'; // صورة افتراضية
    const productDesc = data.short_description || '';
    const productCategory = data.category_name || '';

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
                    <span class="category" style="color: #ffb400; font-weight: bold; text-transform: uppercase; font-size: 12px;">${productCategory}</span>
                </div>
                ${showControls ? `
                <div class="card-actions" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px; display: flex; gap: 10px;">
                    ${isAdmin ? `
                        <button onclick="approveProduct(${productId})" style="flex: 1; background: #5cb85c; color: #fff; border: none; padding: 5px; border-radius: 4px; cursor: pointer; font-size: 12px;">قبول</button>
                        <button onclick="rejectProduct(${productId})" style="flex: 1; background: #d9534f; color: #fff; border: none; padding: 5px; border-radius: 4px; cursor: pointer; font-size: 12px;">رفض</button>
                    ` : `
                        <a href="edit-product.html?id=${productId}" class="edit-btn" style="flex: 1; text-align: center; background: #f0ad4e; color: #fff; padding: 5px; border-radius: 4px; text-decoration: none; font-size: 13px;">تعديل</a>
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

    try {
        // بناء الرابط مع فلتر البراند إن وجد
        let url = '/products/public-list.php';
        if (brandId) url += `?brand_id=${brandId}`;
        
        const result = await FancyAPI.get(url); 

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
            const htmlContent = productsToDisplay.map(product => createProductCardHTML(product, { showControls })).join('');
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
            document.getElementById('project-image').src = product.main_image || 'imges/placeholder.png';
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

        if (result && result.success && Array.isArray(result.data.products)) {
            container.innerHTML = ""; 
            
            if (result.data.products.length === 0) {
                container.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 40px;">ليس لديك أي منتجات حالياً. ابدأ بإضافة منتجك الأول!</p>';
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
            form.elements['product_id'].value = product.id;
            form.elements['brand_id'].value = product.brand_id;
            form.elements['product_name'].value = product.product_name;
            form.elements['category_id'].value = product.category_id || '';
            form.elements['requested_sub_category_name'].value = product.sub_category_name || product.requested_sub_category_name || '';
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
    try {
        const data = {};
        
        const fileToBase64 = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });

        // تحويل البيانات ومعالجة الملفات إن وجدت
        for (let [key, value] of formData.entries()) {
            if (value instanceof File) {
                if (value.size > 0) data[key] = await fileToBase64(value);
            } else {
                data[key] = value === "" ? null : value;
            }
        }

        // تأكيد الأنواع الرقمية لتوافق السيرفر
        data.product_id = Number(data.product_id);
        data.brand_id = Number(data.brand_id);
        if (data.category_id) data.category_id = Number(data.category_id);
        if (data.sub_category_id) data.sub_category_id = Number(data.sub_category_id);

        const result = await FancyAPI.post('/products/update.php', data);

        if (result.success) {
            alert("تم تحديث المنتج بنجاح! التغييرات قيد المراجعة.");
            window.location.href = 'index.html';
        } else {
            alert("خطأ في التحديث: " + (result.message || "فشل الطلب"));
        }
    } catch (error) {
        console.error('Error updating product:', error);
        alert("فشل الاتصال بالسيرفر.");
    }
}

// دالة لإرسال منتج جديد إلى السيرفر
async function submitNewProduct(formData) {
    try {
        const data = {};
        const userData = JSON.parse(localStorage.getItem('userData')) || {};

        // دالة مساعدة لتحويل الملف إلى Base64
        const fileToBase64 = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });

        // تحويل FormData إلى Object ومعالجة الصور
        for (let [key, value] of formData.entries()) {
            if (value instanceof File) {
                if (value.size > 0) {
                    data[key] = await fileToBase64(value);
                }
            } else {
                // إرسال القيم الفارغة كـ null لضمان قبولها في الـ PHP
                data[key] = value === "" ? null : value;
            }
        }

        // تحويل المعرفات إلى أرقام (Numbers) بدلاً من نصوص
        data.brand_id = data.brand_id ? Number(data.brand_id) : 0;
        data.category_id = data.category_id ? Number(data.category_id) : null;
        if (data.sub_category_id) data.sub_category_id = Number(data.sub_category_id);

        console.log("Payload being sent to server:", data);

        // نستخدم المسار المباشر لملف الإنشـاء
        const result = await FancyAPI.post('/products/create.php', data); 

        if (result.success) {
            alert("تم إضافة المنتج بنجاح! هو الآن بانتظار مراجعة الإدارة.");
            window.location.href = 'index.html';
        } else {
            // في حال كان الخطأ Unauthorized، سنطلب منه تسجيل الدخول
            if (result.status === 401) {
                alert("يجب عليك تسجيل الدخول أولاً لإضافة منتج.");
                if (window.showAuthModal) showAuthModal('login');
            } else {
                alert("خطأ: " + (result.message || "حدث خطأ غير متوقع"));
            }
        }
    } catch (error) {
        console.error('Error creating product:', error);
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
