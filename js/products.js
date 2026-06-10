// js/products.js

// دالة موحدة لإنشاء تصميم الكرت للمنتجات
function createProductCardHTML(data, options = {}) {
    const showControls = options.showControls || false;
    const isAdmin = options.isAdmin || false;
    // تأكد من أن `data.id` موجود لتوليد رابط صحيح
    // تم عكس الترتيب هنا لإعطاء الأولوية لـ product_id لتجنب تضارب المعرفات مع الأقسام
    const productId = data.product_id || data.id || ''; 
    const productTitle = data.product_name || 'Unknown Product';
    // استخدام getSafeImageUrl لضمان ظهور الصور المخزنة في قاعدة البيانات
    const productImage = typeof getSafeImageUrl === 'function' ? getSafeImageUrl(data.main_image) : (data.main_image || 'imges/placeholder.png');
    const brandName = data.brand_name || ''; // افتراض أن اسم العلامة التجارية متاح في بيانات المنتج
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
                    <h3 class="card-title">${brandName || 'Brand'}</h3>
                </a>
                <p class="card-product-name" style="font-size: 15px; color: #636161; margin: 5px 0; font-weight: 250;">${productTitle}</p>
                <div class="card-meta">
                    <span class="category" style="font-weight: 100; text-transform: uppercase; font-size: 12px;">${productCategory}</span>
                </div>
                ${showControls ? `
                <div class="card-actions" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px; display: flex; gap: 10px;">
                    ${isAdmin ? (
                        productStatus === 'pending_admin_approval' ? `
                            <button onclick="approveProduct(${productId})" style="flex: 1; background: #5cb85c; color: #fff; border: none; padding: 5px; border-radius: 4px; cursor: pointer; font-size: 12px;">accept</button>
                            <button onclick="rejectProduct(${productId})" style="flex: 1; background: #d9534f; color: #fff; border: none; padding: 5px; border-radius: 4px; cursor: pointer; font-size: 12px;">reject</button>
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
            container.innerHTML = `<p style="text-align: center; grid-column: 1/-1; padding: 40px;">Please <a href="#" class="login-link">log in</a> to view available products.</p>`;
            if (window.showAuthModal) window.showAuthModal('login');
            return;
        }

        if (result && result.success && Array.isArray(result.data.products)) {
            let productsToDisplay = result.data.products;

            // فلترة المنتجات برمجياً للتأكد من أن كل براند يعرض منتجاته فقط
            if (brandId) {
                productsToDisplay = productsToDisplay.filter(p => p.brand_id == brandId);
            }

            if (limit !== null) {
                productsToDisplay = productsToDisplay.slice(0, limit);
            }

            if (productsToDisplay.length === 0) {
                container.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">No products yet.</p>';
                return;
            }

            // استخدام string buffer لتحسين الأداء وتجنب مشاكل الرندر
            const finalShowControls = showControls || isAdmin;
            const htmlContent = productsToDisplay.map(product => createProductCardHTML(product, { showControls: finalShowControls, isAdmin })).join('');
            container.innerHTML = htmlContent;
        } else {
            const detail = result.status === 404 ? 'File list.php not found' : (result.message || 'Unknown error');
            console.error('Failed to load products:', detail, `Status: ${result.status}`);
            container.innerHTML = `<p style="text-align: center; color: red;">Failed to load products: ${detail}</p>`;
        }
    } catch (error) {
        console.error('Error fetching products:', error);
        container.innerHTML = `<p style="text-align: center; color: red;">Server connection error while loading products.</p>`;
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
        // تغيير المسار إلى get.php وتوحيد المعرف ليكون product_id بدلاً من id
        const result = await FancyAPI.get(`/products/get.php?product_id=${productId}`); 

        if (result && result.success && result.data.product) {
            const product = result.data.product;
            // استخدام getSafeImageUrl لتصحيح مسار الصورة وتجنب 404
            document.getElementById('project-image').src = typeof getSafeImageUrl === 'function' ? getSafeImageUrl(product.main_image) : (product.main_image || 'imges/placeholder.png');
            document.getElementById('project-name').innerText = product.product_name || 'منتج غير معروف';
            document.getElementById('project-desc').innerText = product.description || 'لا يوجد وصف لهذا المنتج.';
            document.getElementById('project-category').innerText = product.category_name || "";

            // عرض البيانات التقنية والـ SKU
            const specsContainer = document.getElementById('specs-container');
            const specsDisplay = document.getElementById('project-specs');
            if (specsContainer && specsDisplay) {
                let specsContent = product.technical_data || '';
                
                // جلب الـ SKU من أول خيار متاح كقيمة افتراضية
                const defaultSku = (product.options && product.options.length > 0) ? product.options[0].sku : '';
                if (defaultSku) {
                    specsContent += `<div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #eee; font-weight: bold;">SKU: <span id="active-sku" style="font-weight: normal; color: #666;">${defaultSku}</span></div>`;
                }

                if (specsContent) {
                    specsDisplay.innerHTML = specsContent;
                    specsContainer.classList.remove('hidden');
                }
            }

            // عرض خيارات المنتج (Variants)
            const variantsContainer = document.getElementById('variants-container');
            const optionsGrid = document.getElementById('options-grid');
            if (product.options && product.options.length > 0 && optionsGrid) {
                variantsContainer.classList.remove('hidden');
                optionsGrid.innerHTML = product.options.map(opt => `
                    <div class="option-item" onclick="
                        document.getElementById('project-image').src = '${getSafeImageUrl(opt.image_path || product.main_image)}';
                        const skuElem = document.getElementById('active-sku');
                        if(skuElem) skuElem.innerText = '${opt.sku || ''}';
                    ">
                        <img src="${getSafeImageUrl(opt.image_path || product.main_image)}" 
                             style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 5px; border: 1px solid #eee;">
                        <div style="font-weight: bold;">${opt.option_name}</div>
                        ${opt.type_size ? `<div style="color: #888;">${opt.type_size}</div>` : ''}
                        ${opt.sku ? `<div style="color: #aaa; font-size: 10px;">SKU: ${opt.sku}</div>` : ''}
                    </div>
                `).join('');

                // تحديث المصغرات (Thumbnails) إذا وجدت صور للخيارات
                const thumbs = document.getElementById('thumbnails');
                if (thumbs) {
                    thumbs.innerHTML = product.options
                        .filter(o => o.image_path)
                        .map(o => `<img src="${getSafeImageUrl(o.image_path)}" class="thumb-img" onclick="document.getElementById('project-image').src = this.src">`)
                        .join('');
                }
            }

            const whatsappBtn = document.getElementById('whatsapp-btn');
            // تحديث رابط الواتساب
            if (whatsappBtn) {
                const message = encodeURIComponent(`السلام عليكم، أود الاستفسار عن تفاصيل وسعر: ${product.product_name}`);
                // يمكنك استبدال 'YOUR_DEFAULT_WHATSAPP_NUMBER' برقم واتساب افتراضي إذا لم يكن متوفراً في بيانات المنتج
                whatsappBtn.href = `https://wa.me/${product.whatsapp || '966500000000'}?text=${message}`; 
            }
            
            // تحميل المنتجات المشابهة بناءً على القسم الفرعي (Sub-Category) لزيادة الدقة
            loadRelatedProducts(product.sub_category_id, productId);
        } else {
            console.error('Product Access Error:', result);
            const detail = result.message || 'Product not found or access denied.';
            // بدلاً من التنبيه المزعج، يمكننا عرض رسالة داخل الصفحة أو الاكتفاء بالتحويل
            console.warn(`Redirecting: ${detail}`);
            // window.location.href = "index.html"; 
        }
    } catch (error) {
        console.error('Error fetching single product:', error);
        window.location.href = "index.html"; // إعادة التوجيه للصفحة الرئيسية عند الخطأ
    }
}

// دالة لجلب وعرض المنتجات المشابهة (You May Also Like)
async function loadRelatedProducts(subCategoryId, currentProductId) {
    const container = document.getElementById('related-products');
    if (!container || !subCategoryId) return;

    try {
        // جلب المنتجات التي تنتمي لنفس القسم الفرعي
        const result = await FancyAPI.get(`/products/public-list.php?sub_category_id=${subCategoryId}`);
        
        if (result && result.success && result.data && Array.isArray(result.data.products)) {
            // تصفية المنتج الحالي من القائمة واختيار أول 4 منتجات فقط
            const related = result.data.products
                .filter(p => (p.id || p.product_id) != currentProductId)
                .slice(0, 4);

            if (related.length > 0) {
                container.innerHTML = related.map(p => createProductCardHTML(p)).join('');
            } else {
                // إخفاء القسم بالكامل إذا لم تكن هناك منتجات مشابهة
                const section = document.querySelector('.related-section');
                if (section) section.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error loading related products:', error);
    }
}

// دالة لجلب وعرض منتجات المستخدم المسجل حالياً
async function loadMyProducts(containerId, brandId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        let url = '/products/my-products.php';
        if (brandId) {
            url += `?brand_id=${brandId}`;
        }
        const result = await FancyAPI.get(url);

        if (result.status === 401) {
            container.innerHTML = `<p style="text-align: center; color: #666; grid-column: 1/-1; padding: 40px;">You must <a href="#" class="login-link">log in</a> to manage your products.</p>`;
            if (window.showAuthModal) window.showAuthModal('login');
            return;
        }

        if (result && result.success && Array.isArray(result.data.products)) {
            container.innerHTML = ""; 
            
            if (result.data.products.length === 0) {
                container.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 40px;">No products yet.</p>';
                return;
            }

            result.data.products.forEach(product => {
                // فلترة المنتجات برمجياً للتأكد من أن كل براند يعرض منتجاته فقط
                if (brandId && product.brand_id != brandId) {
                    return; // تخطي المنتجات التي لا تنتمي للبراند المحدد
                }

                container.innerHTML += createProductCardHTML(product, { showControls: true });
            });
        } else {
            const detail = result.status === 401 ? 'You must log in to view products' : (result.message || 'Unknown error');
            console.error('Failed to load my products:', detail);
            container.innerHTML = `<p style="text-align: center; color: red; grid-column: 1/-1;">${detail}</p>`;
        }
    } catch (error) {
        console.error('Error fetching my products:', error);
        container.innerHTML = `<p style="text-align: center; color: red; grid-column: 1/-1;">Server connection error.</p>`;
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
            alert("Failed to fetch product data: " + (result.message || "Unknown error"));
            window.location.href = 'my-products.html';
        }
    } catch (error) {
        console.error('Error loading product for edit:', error);
        alert("An error occurred while loading data.");
    }
}

// دالة إرسال التحديث إلى update.php
async function submitProductUpdate(formData) {
    try {
        // التأكد من وجود product_id داخل الـ FormData في حال كان الحقل يسمى id في النموذج
        if (!formData.has('product_id') && formData.has('id')) {
            formData.append('product_id', formData.get('id'));
        }

        // إرسال الـ formData مباشرة بدلاً من تحويلها لـ JSON
        // هذا يسمح للـ PHP بقراءة البيانات عبر $_POST ومعالجة الملفات عبر $_FILES
        const result = await FancyAPI.post('/products/update.php', formData);
        
        if (result.success) {
            alert('Updated successfully!');
            window.location.href = 'profile.html';
        } else {
            alert('Failed: ' + (result.message || 'Validation error (422)'));
        }
    } catch (error) {
        console.error('Update Error:', error);
        alert("An error occurred while updating the product.");
    }
}

async function submitNewProduct(formData) {
    try {
        const result = await FancyAPI.post('/products/create.php', formData);
        if (result.success) {
            alert("Product added successfully!");
            window.location.href = 'index.html';
        } else {
            alert("Error: " + (result.message || "Something went wrong"));
        }
    } catch (error) {
        console.error('Error:', error);
        alert("Server connection failed.");
    }
}
// دالة لجلب وعرض المنتجات المعلقة (للمدير فقط)
async function loadPendingProductsForAdmin(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || (userData.account_type !== 'admin' && userData.role !== 'admin')) {
        container.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 40px; color: red;">You do not have permission to access this page.</p>';
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
                container.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 40px;">No pending products for review currently.</p>';
                return;
            }

            result.data.products.forEach(product => {
                container.innerHTML += createProductCardHTML(product, { showControls: true, isAdmin: true });
            });
        } else {
            const detail = result.status === 401 ? 'Admin login required' : (result.message || 'Unknown error');
            console.error('Failed to load pending products:', detail);
            container.innerHTML = `<p style="text-align: center; color: red; grid-column: 1/-1;">${detail}</p>`;
        }
    } catch (error) {
        console.error('Error fetching pending products:', error);
        container.innerHTML = `<p style="text-align: center; color: red; grid-column: 1/-1;">Server connection error.</p>`;
    }
}

// دالة قبول المنتج
async function approveProduct(id) {
    if (!confirm('Approve this product?')) return;
    const result = await FancyAPI.post('/admin/approve-product.php', { product_id: id });
    if (result.success) {
        alert('Product approved successfully');
        loadPendingProductsForAdmin('pending-products-container');
    } else {
        alert('Approval failed: ' + result.message);
    }
}

// دالة رفض المنتج
async function rejectProduct(id) {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    const result = await FancyAPI.post('/admin/reject-product.php', { product_id: id, reason: reason });
    if (result.success) {
        alert('Product rejected');
        loadPendingProductsForAdmin('pending-products-container');
    } else {
        alert('Rejection failed: ' + result.message);
    }
}

// دالة إيقاف المنتج (للإدارة)
async function suspendProduct(id) {
    if (!confirm('Stop this product? It will be hidden from public view.')) return;
    const result = await FancyAPI.post('/admin/suspend-product.php', { product_id: id });
    if (result.success) {
        alert('Product stopped successfully');
        location.reload(); // تحديث الصفحة لرؤية التغييرات
    } else {
        alert('Suspension failed: ' + result.message);
    }
}

// دالة حذف المنتج نهائياً
async function deleteProduct(id) {
    if (!confirm('Warning: Are you sure you want to delete this product permanently? This action cannot be undone.')) return;
    try {
        // إرسال طلب الحذف إلى السيرفر
        const result = await FancyAPI.post('/products/delete.php', { product_id: id });
        if (result.success) {
            alert(result.message || 'Product deleted successfully');
            // إعادة تحميل الصفحة لتحديث القائمة
            location.reload();
        } else {
            alert('Deletion failed: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Delete product error:', error);
        alert('Server connection error during product deletion.');
    }
}

// جعل الدوال متاحة عالمياً
window.createProductCardHTML = createProductCardHTML;
window.loadProducts = loadProducts;
window.loadSingleProductDetails = loadSingleProductDetails;
window.loadRelatedProducts = loadRelatedProducts;
window.loadMyProducts = loadMyProducts;
window.loadProductDataForEdit = loadProductDataForEdit;
window.submitProductUpdate = submitProductUpdate;
window.submitNewProduct = submitNewProduct;
window.loadPendingProductsForAdmin = loadPendingProductsForAdmin;
window.approveProduct = approveProduct;
window.rejectProduct = rejectProduct;
window.suspendProduct = suspendProduct;
window.deleteProduct = deleteProduct;
