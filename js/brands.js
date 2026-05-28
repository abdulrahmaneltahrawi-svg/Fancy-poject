/**
 * brands.js - معالجة بيانات العلامة التجارية (تحديث الملف الشخصي للمصمم)
 */

// دالة لجلب وعرض جميع البراندات في الصفحة
async function displayAllBrands() {
    const container = document.getElementById('brands-container');
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
            container.innerHTML = ''; // تفريغ الحاوية

            brands.forEach(brand => {
                // التحقق من وجود صور جانبية لضبط التنسيق (Grid vs Single)
                const hasSideImages = brand.side_img1 || brand.side_img2;
                const gridClass = hasSideImages ? '' : 'single-layout';

                const brandHtml = `
                    <div class="brand-card">
                        <a href="veiw_brands.html?brand=${brand.id}" style="text-decoration: none; color: inherit;">
                            <div class="brand-images-grid ${gridClass}">
                                <div class="main-img">
                                    <img src="${brand.cover_image || brand.main_image || 'imges/img/fancy1.jfif'}" alt="${brand.brand_name}" />
                                </div>
                                ${hasSideImages ? `
                                <div class="side-imgs">
                                    ${brand.side_img1 ? `<img src="${brand.side_img1}" alt="item" />` : ''}
                                    ${brand.side_img2 ? `<img src="${brand.side_img2}" alt="item" />` : ''}
                                </div>
                                ` : ''}
                            </div>
                            <div class="brand-info">
                                <img
                                    src="${brand.logo || 'imges/img/fancy1.jfif'}"
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

async function submitNewBrand(formData) {
    try {
        // تحويل FormData إلى كائن عادي ليتم إرساله كـ JSON
        // لأن السيرفر يتوقع JSON (وهذا سبب خطأ 422 عند إرسال FormData مباشرة)
        const data = {};
        
        // دالة لتحويل ملفات الصور إلى Base64 لإدراجها في الـ JSON
        const fileToBase64 = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });

        // استخراج البيانات من FormData ومعالجة الصور
        for (let [key, value] of formData.entries()) {
            if (value instanceof File) {
                if (value.size > 0) {
                    data[key] = await fileToBase64(value);
                } else {
                    data[key] = null;
                }
            } else {
                data[key] = value;
            }
        }

        // إضافة حقول قد تكون مطلوبة في قاعدة البيانات مثل كود الدولة
        if (!data.phone_code) data.phone_code = "";

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
                const brandHtml = `
                    <div class="brand-card">
                        <a href="view_brands.html?brand=${brand.id}" style="text-decoration: none; color: inherit;">
                            <div class="brand-images-grid ${gridClass}">
                                <div class="main-img">
                                    <img src="${brand.cover_image || brand.main_image || 'imges/img/fancy1.jfif'}" alt="${brand.brand_name}" />
                                </div>
                                ${hasSideImages ? `
                                <div class="side-imgs">
                                    ${brand.side_img1 ? `<img src="${brand.side_img1}" alt="item" />` : ''}
                                    ${brand.side_img2 ? `<img src="${brand.side_img2}" alt="item" />` : ''}
                                </div>
                                ` : ''}
                            </div>
                            <div class="brand-info">
                                <img
                                    src="${brand.logo || 'imges/img/fancy1.jfif'}"
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

window.loadMyBrandForEdit = loadMyBrandForEdit;
window.updateBrandProfile = updateBrandProfile;
window.displayAllBrands = displayAllBrands;
window.submitNewBrand = submitNewBrand;
window.displayUserBrands = displayUserBrands;