// js/products.js

// دالة موحدة لإنشاء تصميم الكرت للمنتجات
function createProductCardHTML(data) {
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
            </div>
        </div>
    `;
}

// دالة لجلب وعرض المنتجات من الـ API
async function loadProducts(containerId, limit = null) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID '${containerId}' not found.`);
        return;
    }

    try {
        // افتراض وجود API endpoint لجلب المنتجات
        const result = await FancyAPI.get('/products/public-list.php'); 

        if (result && result.success && Array.isArray(result.data.products)) {
            container.innerHTML = ""; // مسح أي محتوى موجود

            let productsToDisplay = result.data.products;
            if (limit !== null) {
                productsToDisplay = productsToDisplay.slice(0, limit);
            }

            productsToDisplay.forEach(product => {
                container.innerHTML += createProductCardHTML(product);
            });
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
        const result = await FancyAPI.get(`/products/get.php?id=${productId}`); // افتراض أن هذا الـ API يعيد تفاصيل منتج واحد

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

// جعل الدوال متاحة عالمياً
window.createProductCardHTML = createProductCardHTML;
window.loadProducts = loadProducts;
window.loadSingleProductDetails = loadSingleProductDetails;
