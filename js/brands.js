/**
 * brands.js - معالجة بيانات العلامة التجارية (تحديث الملف الشخصي للمصمم)
 */

// دالة مساعدة لضمان صحة مسار الصورة (تضيف رابط الـ API إذا كان المسار نسبياً)
function getSafeImageUrl(path) {
    if (!path) return 'imges/img/fancy1.jfif'; // الصورة الافتراضية
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    
    // تنظيف المسار من أي سلاش زائد في البداية
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    
    // الربط مع مسار الـ API الموجود في FancyAPI (js/script.js)
    // نفترض أن المجلد هو uploads في جذر الـ API
    return `${FancyAPI.baseUrl}/${cleanPath}`;
}

// دالة لجلب وعرض جميع البراندات في الصفحة
async function displayAllBrands(containerId = 'brands-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        // جلب قائمة العلامات التجارية النشطة من السيرفر
        const result = await FancyAPI.get('/brands/active-brands.php'); 
        
        console.log('Brands API Response:', result); // لمساعدتك في تتبع البيانات في الكونسول

        let brands = null;
        if (result.success && result.data) {
            // محاولة استخراج البيانات سواء كانت في data مباشرة أو داخل data.brands
            let rawData = result.data.brands || result.data;
            
            // إذا كانت البيانات مصفوفة نأخذها مباشرة، وإذا كانت Object نحولها لمصفوفة
            if (Array.isArray(rawData)) {
                brands = rawData;
            } else if (typeof rawData === 'object' && rawData !== null) {
                brands = Object.values(rawData);
            }
        }

        if (result.ok && result.success && brands && brands.length > 0) {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const isAdmin = userData.account_type === 'admin' || userData.role === 'admin';

            container.innerHTML = ''; // تفريغ الحاوية

            brands.forEach(brand => {
                // التحقق من وجود صور جانبية لضبط التنسيق (Grid vs Single)
                const hasSideImages = brand.side_img1 || brand.side_img2;
                const gridClass = hasSideImages ? '' : 'single-layout';

                const brandHtml = `
                    <div class="brand-card">
                        <a href="view_brands.html?brand=${brand.id}" style="text-decoration: none; color: inherit;">
                            <div class="brand-images-grid ${gridClass}">
                                <div class="main-img">
                                    <img src="${getSafeImageUrl(brand.cover_image || brand.main_image)}" alt="${brand.brand_name}" />
                                </div>
                                ${hasSideImages ? `
                                <div class="side-imgs">
                                    ${brand.side_img1 ? `<img src="${getSafeImageUrl(brand.side_img1)}" alt="item" />` : ''}
                                    ${brand.side_img2 ? `<img src="${getSafeImageUrl(brand.side_img2)}" alt="item" />` : ''}
                                </div>
                                ` : ''}
                            </div>
                            <div class="brand-info" style="padding: 10px;">
                                <img
                                    src="${getSafeImageUrl(brand.logo)}"
                                    alt="logo"
                                    class="brand-logo"
                                />
                                <div class="brand-text">
                                    <h3>${brand.brand_name || brand.name || 'علامة تجارية'}</h3>
                                    <p>${brand.country || ''} | ${brand.city || ''}</p>
                                    <span style="pad">${brand.brand_type || ''}</span>
                                </div>
                            </div>
                        </a>
                        ${isAdmin ? `
                        <div class="admin-mgmt-btns" style="padding: 10px; border-top: 1px solid #eee; background: #fdfdfd;">
                            <button onclick="suspendBrand(${brand.id})" style=" padding: 6px; background: #ff0000; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">إيقاف </button>
                        </div>
                        ` : ''}
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', brandHtml);
            });
        } else if (result.success && (!brands || brands.length === 0)) {
            container.innerHTML = `<p style="text-align: center; grid-column: 1/-1; padding: 50px;">لا توجد علامات تجارية نشطة حالياً في قاعدة البيانات.</p>`;
        } else {
            console.error('API Validation Error:', result);
            container.innerHTML = `<p style="text-align: center; color: red;">خطأ في تحميل البيانات: ${result.message || 'استجابة غير متوقعة'}</p>`;
        }
    } catch (error) {
        console.error('Error fetching brands:', error);
        container.innerHTML = '<p>حدث خطأ أثناء تحميل العلامات التجارية.</p>';
    }
}

// دالة لجلب بيانات البراند الخاصة بالمستخدم المسجل لتعبئة نموذج التعديل
async function loadMyBrandForEdit(specificBrandId = null) {
    const userData = localStorage.getItem('userData');
    if (!userData) return;

    try {
        const user = JSON.parse(userData);
        // الأولوية لمعرف البراند المحدد (إذا تم تمريره)، ثم معرف البراند المخزن في بيانات المستخدم
        const brandId = specificBrandId || user.brand_id;
        
        // إذا لم يتم العثور على brandId، نتحقق مما إذا كان المستخدم هو صاحب البراند
        // (هذا السيناريو قد يحدث إذا كان المستخدم مصممًا وليس براندًا، أو لم ينشئ براند بعد)
        // ولكن في سياق تعديل براند، يجب أن يكون هناك brandId
        if (!brandId) {
            console.warn('No Brand ID found for the current user.');
            return;
        }

        // استدعاء بيانات البراند عبر API الجلب
        const result = await FancyAPI.get(`/brands/get.php?brand_id=${brandId}`);
        
        if (result.ok && result.success && result.data && result.data.brand) {
            const brand = result.data.brand;
            const form = document.getElementById('editBrandForm');
            if (!form) return;

            // تعبئة حقول النموذج بالبيانات الحالية من السيرفر
            if (form.elements['brand_id']) form.elements['brand_id'].value = brand.id;
            if (form.elements['brand_name']) form.elements['brand_name'].value = brand.brand_name || brand.name;
            if (form.elements['brand_type']) form.elements['brand_type'].value = brand.brand_type || '';
            if (form.elements['email']) form.elements['email'].value = brand.email || '';
            if (form.elements['phone']) form.elements['phone'].value = brand.phone || '';
            if (form.elements['country']) form.elements['country'].value = brand.country || '';
            if (form.elements['city']) form.elements['city'].value = brand.city || '';
            if (form.elements['website']) form.elements['website'].value = brand.website || '';
            if (form.elements['description']) form.elements['description'].value = brand.description || '';
        }
    } catch (error) {
        console.error('Error loading brand for edit:', error);
    }
}

// دالة لإرسال تحديث بيانات البراند إلى السيرفر (Update)
async function updateBrandProfile(formData) {
    try {
        const data = {};
        const fileToBase64 = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });

        for (let [key, value] of formData.entries()) {
            if (value instanceof File && value.size > 0) {
                data[key] = await fileToBase64(value);
            } else if (value instanceof File && value.size === 0) {
                // إذا لم يتم اختيار ملف، لا نرسل هذا المفتاح للحفاظ على الصورة القديمة
                continue;
            } else {
                data[key] = value;
            }
        }

        const result = await FancyAPI.post('/brands/update.php', data);

        if (result.success) {
            alert("تم تحديث بيانات العلامة التجارية بنجاح!");
            
            // تحديث الاسم في localStorage لضمان ظهوره في الهيدر فوراً
            const userData = JSON.parse(localStorage.getItem('userData'));
            userData.brand_name = data.brand_name;
            localStorage.setItem('userData', JSON.stringify(userData));
            
            window.location.href = 'profile.html'; // العودة لصفحة البروفايل
        } else {
            alert("خطأ في التحديث: " + (result.message || "فشل الطلب"));
        }
    } catch (error) {
        console.error('Error updating brand:', error);
        alert("فشل الاتصال بالسيرفر أثناء التحديث.");
    }
}

async function submitNewBrand(formData) {
    try {
        const data = {};
        const fileToBase64 = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });

        for (let [key, value] of formData.entries()) {
            if (value instanceof File) {
                if (value.size > 0) {
                    data[key] = await fileToBase64(value);
                } else {
                    data[key] = null; // إرسال null صريح لضمان معالجة الحقل في PHP
                }
            } else {
                data[key] = value;
            }
        }

        console.log("Sending brand data as JSON with Base64 images...");
        const result = await FancyAPI.post('/brands/create.php', data); 
        
        if (result.success) {
            alert(result.message || "تم إرسال طلب تسجيل البراند بنجاح!");
            
            let userData = JSON.parse(localStorage.getItem('userData')) || {};
            if (result.data && (result.data.brand_id || result.data.id)) {
                userData.brand_id = result.data.brand_id || result.data.id;
                localStorage.setItem('userData', JSON.stringify(userData));
            }
            window.location.href = 'profile.html';
        } else {
            alert("خطأ من السيرفر: " + (result.message || "فشل في إرسال الطلب"));
        }
    } catch (error) {
        console.error('Error submitting brand:', error);
        alert("حدث خطأ في الاتصال بالسيرفر.");
    }
}

// دالة لجلب وعرض البراندات الخاصة بالمستخدم المسجل في صفحته الشخصية
async function displayUserBrands(containerId = 'user-brands-list') {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        // استدعاء API لجلب براندات المستخدم (يفترض وجود ملف my-brands.php)
        const result = await FancyAPI.get('/brands/my-brands.php'); 
        
        let brands = null;
        if (result.success && result.data) {
            let rawData = result.data.brands || result.data;
            if (Array.isArray(rawData)) {
                brands = rawData;
            } else if (typeof rawData === 'object' && rawData !== null) {
                brands = Object.values(rawData);
            }
        }

        if (result.success && brands && brands.length > 0) {
            container.innerHTML = ''; 
            brands.forEach(brand => {
                const hasSideImages = brand.side_img1 || brand.side_img2;
                const gridClass = hasSideImages ? '' : 'single-layout';
                const brandId = brand.id || brand.brand_id;
                const brandHtml = `
                    <div class="brand-card">
                        <a href="view_brands.html?brand=${brandId}" style="text-decoration: none; color: inherit;">
                            <div class="brand-images-grid ${gridClass}">
                                <div class="main-img">
                                    <img src="${getSafeImageUrl(brand.cover_image || brand.main_image)}" alt="${brand.brand_name}" />
                                </div>
                                ${hasSideImages ? `
                                <div class="side-imgs">
                                    ${brand.side_img1 ? `<img src="${getSafeImageUrl(brand.side_img1)}" alt="item" />` : ''}
                                    ${brand.side_img2 ? `<img src="${getSafeImageUrl(brand.side_img2)}" alt="item" />` : ''}
                                </div>
                                ` : ''}
                            </div>
                            <div class="brand-info">
                                <img
                                    src="${getSafeImageUrl(brand.logo)}"
                                    alt="logo"
                                    class="brand-logo"
                                />
                                <div class="brand-text">
                                    <h3>${brand.brand_name || brand.name || 'علامة تجارية'}</h3>
                                    <p>${brand.country || ''} | ${brand.city || ''}</p>
                                    <span>${brand.brand_type || ''}</span>
                                </div>
                            </div>
                        </a>
                        <div class="brand-mgmt-btns" style="display: flex; gap: 8px; padding: 10px; border-top: 1px solid #eee; background: #fafafa;">
                            <button onclick="deactivateBrand(${brandId})" style="flex: 1; padding: 8px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; font-size: 13px; color: #666; transition: 0.3s;">تعطيل</button>
                            <button onclick="deleteBrand(${brandId})" style="flex: 1; padding: 8px; border: none; background: #d9534f; color: #fff; border-radius: 4px; cursor: pointer; font-size: 13px; transition: 0.3s;">حذف</button>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', brandHtml);
            });
        } else {
            container.innerHTML = `<p style="text-align: center; padding: 40px; grid-column: 1/-1;">لا توجد علامات تجارية لعرضها حالياً.</p>`;
        }
    } catch (error) {
        console.error('Error fetching user brands:', error);
        container.innerHTML = '<p style="text-align: center; color: red; grid-column: 1/-1;">حدث خطأ أثناء تحميل بيانات البراندات.</p>';
    }
}

// دالة لتعطيل العلامة التجارية
async function deactivateBrand(brandId) {
    if (!confirm('هل أنت متأكد من تعطيل هذه العلامة التجارية؟')) return;
    try {
        const result = await FancyAPI.post('/brands/deactivate.php', { brand_id: brandId });
        if (result.success) {
            alert(result.message || 'تم تعطيل البراند بنجاح');
            displayUserBrands(); // تحديث القائمة
        } else {
            alert(result.message || 'فشل التعطيل');
        }
    } catch (error) {
        console.error('Deactivate error:', error);
    }
}

// دالة لحذف العلامة التجارية
async function deleteBrand(brandId) {
    if (!confirm('تحذير: هل أنت متأكد من حذف هذه العلامة التجارية نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    try {
        const result = await FancyAPI.post('/brands/delete.php', { brand_id: brandId });
        if (result.success) {
            alert(result.message || 'تم حذف البراند بنجاح');
            displayUserBrands(); // تحديث القائمة
        } else {
            alert(result.message || 'فشل الحذف');
        }
    } catch (error) {
        console.error('Delete error:', error);
    }
}

// دالة جلب البراندات المعلقة للمدير
async function loadPendingBrandsForAdmin(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // التحقق من الصلاحيات محلياً قبل إرسال الطلب للسيرفر لتجنب خطأ 403
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || (userData.account_type !== 'admin' && userData.role !== 'admin')) {
        container.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">غير مسموح لك بالوصول لبيانات الإدارة.</p>';
        return;
    }

    try {
        const result = await FancyAPI.get('/admin/pending-brands.php');
        if (result.success && Array.isArray(result.data.brands)) {
            container.innerHTML = result.data.brands.length ? '' : '<p style="grid-column:1/-1; text-align:center;">لا توجد براندات معلقة.</p>';
            result.data.brands.forEach(brand => {
                container.innerHTML += `
                    <div class="brand-card" style="border: 1px solid #eee; padding: 15px; border-radius: 8px;">
                        <img src="${brand.logo || 'imges/img/fancy1.jfif'}" style="width:50px; height:50px; border-radius:50%;">
                        <h3>${brand.brand_name}</h3>
                        <p>${brand.brand_type} - ${brand.country}</p>
                        <div style="display:flex; gap:10px; margin-top:10px;">
                            <button onclick="approveBrand(${brand.id})" style="flex:1; background:#5cb85c; color:#fff; border:none; padding:8px; border-radius:4px; cursor:pointer;">قبول</button>
                            <button onclick="rejectBrand(${brand.id})" style="flex:1; background:#d9534f; color:#fff; border:none; padding:8px; border-radius:4px; cursor:pointer;">رفض</button>
                        </div>
                    </div>
                `;
            });
        }
    } catch (error) { console.error(error); }
}

// دالة قبول البراند
async function approveBrand(id) {
    if (!confirm('هل تريد قبول هذه العلامة التجارية؟')) return;
    const result = await FancyAPI.post('/admin/approve-brand.php', { brand_id: id });
    if (result.success) {
        alert('تم قبول البراند');
        loadPendingBrandsForAdmin('pending-brands-list');
    } else {
        alert('خطأ: ' + result.message);
    }
}

// دالة رفض البراند
async function rejectBrand(id) {
    const reason = prompt('سبب الرفض:');
    if (reason === null) return;
    const result = await FancyAPI.post('/admin/reject-brand.php', { brand_id: id, reason: reason });
    if (result.success) {
        alert('تم رفض البراند');
        loadPendingBrandsForAdmin('pending-brands-list');
    } else {
        alert('خطأ: ' + result.message);
    }
}

// دالة إيقاف البراند (للإدارة)
async function suspendBrand(id) {
    if (!confirm('هل تريد إيقاف هذه العلامة التجارية؟ سيتم إخفاء البراند ومنتجاته.')) return;
    const result = await FancyAPI.post('/admin/suspend-brand.php', { brand_id: id });
    if (result.success) {
        alert('تم إيقاف العلامة التجارية بنجاح');
        location.reload();
    } else {
        alert('خطأ: ' + result.message);
    }
}

window.loadMyBrandForEdit = loadMyBrandForEdit;
window.updateBrandProfile = updateBrandProfile;
window.displayAllBrands = displayAllBrands;
window.submitNewBrand = submitNewBrand;
window.displayUserBrands = displayUserBrands;
window.deactivateBrand = deactivateBrand;
window.deleteBrand = deleteBrand;
window.loadPendingBrandsForAdmin = loadPendingBrandsForAdmin;
window.approveBrand = approveBrand;
window.rejectBrand = rejectBrand;
window.suspendBrand = suspendBrand;