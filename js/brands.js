/**
 * brands.js - معالجة بيانات العلامة التجارية (تحديث الملف الشخصي للمصمم)
 */

// دالة لجلب وعرض جميع البراندات في الصفحة
async function displayAllBrands() {
    const container = document.getElementById('brands-container');
    if (!container) return;

    try {
        // نستخدم list.php لجلب كافة البراندات لأن get.php مخصص لجلب براند واحد بواسطة الـ ID
        const result = await FancyAPI.get('/brands/get.php'); 
        
        if (result.ok && result.success && Array.isArray(result.data)) {
            const brands = result.data;
            container.innerHTML = ''; // تفريغ الحاوية

            brands.forEach(brand => {
                // التأكد من وجود مسار للصورة أو استخدام صورة افتراضية
                const brandHtml = `
                    <div class="brand-card">
                        <a href="view_companys.html?brand=${brand.id}" style="text-decoration: none; color: inherit;">
                            <div class="brand-images-grid">
                                <div class="main-img">
                                    <img src="${brand.main_image || 'imges/img/fancy1.jfif'}" alt="${brand.brand_name}" />
                                </div>
                                <div class="side-imgs">
                                    <img src="${brand.side_img1 || 'imges/img/fancy1.jfif'}" alt="item" />
                                    <img src="${brand.side_img2 || 'imges/img/fancy1.jfif'}" alt="item" />
                                </div>
                            </div>
                            <div class="brand-info">
                                <img
                                    src="${brand.logo || 'imges/img/fancy1.jfif'}"
                                    alt="logo"
                                    class="brand-logo"
                                />
                                <div class="brand-text">
                                    <h3>${brand.brand_name}</h3>
                                    <p>${brand.country || ''} | ${brand.city || ''}</p>
                                    <span>${brand.brand_type || ''}</span>
                                </div>
                            </div>
                        </a>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', brandHtml);
            });
        } else {
            console.error('API Validation Error:', result);
            container.innerHTML = `<p>${result.message || 'لا توجد علامات تجارية متاحة حالياً.'}</p>`;
        }
    } catch (error) {
        console.error('Error fetching brands:', error);
        container.innerHTML = '<p>حدث خطأ أثناء تحميل العلامات التجارية.</p>';
    }
}

// دالة لجلب بيانات البراند الخاصة بالمستخدم المسجل لتعبئة نموذج التعديل
async function loadMyBrandForEdit() {
    const userData = localStorage.getItem('userData');
    if (!userData) return;

    try {
        const user = JSON.parse(userData);
        // نستخدم الـ ID الخاص بالبراند المخزن في بيانات المستخدم
        const brandId = user.brand_id || user.id; 
        
        if (!brandId) {
            console.warn('No Brand ID found for the current user.');
            return;
        }

        // استدعاء بيانات البراند عبر API الجلب
        const result = await FancyAPI.get(`/brands/get.php?id=${brandId}`);
        
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
async function updateBrandProfile(formDataObject) {
    try {
        // إرسال البيانات إلى ملف update.php المذكور في الـ API
        const result = await FancyAPI.post('/brands/update.php', formDataObject);

        if (result.success) {
            alert("تم تحديث بيانات العلامة التجارية بنجاح!");
            
            // تحديث الاسم في localStorage لضمان ظهوره في الهيدر فوراً
            const userData = JSON.parse(localStorage.getItem('userData'));
            userData.brand_name = formDataObject.brand_name;
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

window.loadMyBrandForEdit = loadMyBrandForEdit;
window.updateBrandProfile = updateBrandProfile;
window.displayAllBrands = displayAllBrands;