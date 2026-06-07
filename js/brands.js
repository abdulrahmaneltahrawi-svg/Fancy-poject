// دالة getSafeImageUrl معرفة عالمياً في script.js
// دالة لجلب وعرض جميع البراندات في الصفحة
async function displayAllBrands(containerId = 'brands-container', limit = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        // جلب قائمة العلامات التجارية العامة من السيرفر
        const result = await FancyAPI.get('/brands/public-list.php');

        // التعامل مع حالة عدم المصادقة (خطأ 401)
        if (result.status === 401) {
            localStorage.removeItem('userData'); // تنظيف أي بيانات جلسة قديمة محلياً
            container.innerHTML = `<p style="text-align: center; grid-column: 1/-1; padding: 50px;">Please <a href="#" class="login-link" style="color: var(--primary-color); font-weight: bold;">log in</a> to view brands.</p>`;
            if (window.showAuthModal) window.showAuthModal('login');
            return;
        }

        if (result && result.success) {
            // استخراج المصفوفة بشكل مرن (سواء كانت داخل data.brands أو data مباشرة)
            let brands = result.data?.brands || (Array.isArray(result.data) ? result.data : []);
            
            container.innerHTML = ''; // تفريغ الحاوية قبل البدء

            // تطبيق الحد الأقصى للعرض إذا تم تحديده (مفيد للرئيسية)
            if (limit !== null) {
                brands = brands.slice(0, limit);
            }

            if (brands.length === 0) {
                container.innerHTML = `<p style="text-align: center; grid-column: 1/-1; padding: 50px;">There are no currently active brands.</p>`;
                return;
            }

            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const isAdmin = userData.account_type === 'admin' || userData.role === 'admin';

            brands.forEach(brand => {
                // التحقق من وجود صور جانبية لضبط التنسيق (Grid vs Single)
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
                            <div class="brand-info" style="padding: 10px;">
                                <img
                                    src="${getSafeImageUrl(brand.logo)}"
                                    alt="logo"
                                    class="brand-logo"
                                />
                                <div class="brand-text">
                                    <h3>${brand.brand_name || brand.name || 'Brand'}</h3>
                                    <p>${brand.country || ''} | ${brand.city || ''}</p>
                                    <span>${brand.brand_type || ''}</span>
                                </div>
                            </div>
                        </a>
                        ${isAdmin ? `
                        <div class="admin-mgmt-btns" style="padding: 10px; border-top: 1px solid #eee; background: #fdfdfd;">
                            <button onclick="suspendBrand(${brandId})" style=" padding: 6px; background: #ff0000; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">Stop </button>
                        </div>
                        ` : ''}
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', brandHtml);
            });
        } else {
            // تحسين الرسالة: إذا كان هناك بيانات مستخدم في المتصفح، فالخطأ تقني وليس نقص تسجيل دخول
            const hasSession = localStorage.getItem('userData');
            if (hasSession) {
                container.innerHTML = `<p style="text-align: center; padding: 50px; grid-column: 1/-1; color: #666;">Failed to load brands. Please try again later.</p>`;
            } else {
                container.innerHTML = `<p style="text-align: center; padding: 50px; grid-column: 1/-1;">Please <a href="#" class="login-link">log in</a> to view brands.</p>`;
            }
        }
    } catch (error) {
        console.error('Error fetching brands:', error);
        container.innerHTML = '<p>An error occurred while loading brands.</p>';
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
        
        if (result.status === 401) {
            if (window.showAuthModal) window.showAuthModal('login');
            return;
        }

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
        console.log("Updating brand data as FormData...");
        const result = await FancyAPI.post('/brands/update.php', formData);

        if (result.success) {
            alert("Brand data updated successfully!");
            
            // تحديث الاسم في localStorage لضمان ظهوره في الهيدر فوراً
            const userData = JSON.parse(localStorage.getItem('userData'));
            userData.brand_name = formData.get('brand_name');
            localStorage.setItem('userData', JSON.stringify(userData));
            
            window.location.href = 'profile.html'; // العودة لصفحة البروفايل
        } else {
            alert("Update error: " + (result.message || "Request failed"));
        }
    } catch (error) {
        console.error('Error updating brand:', error);
        alert("Failed to connect to the server during update.");
    }
}

async function submitNewBrand(formData) {
    try {
        // التحقق من وجود البيانات الأساسية قبل الإرسال لتجنب 422
        if (!formData.get('brand_name')) {
            alert("Brand name is required");
            return;
        }

        console.log("Sending brand data as FormData...");
        const result = await FancyAPI.post('/brands/create.php', formData); 
        
        if (result.success) {
            alert(result.message || "Brand created successfully!");
            
            let userData = JSON.parse(localStorage.getItem('userData')) || {};
            if (result.data && (result.data.brand_id || result.data.id)) {
                userData.brand_id = result.data.brand_id || result.data.id;
                // تحديث الحالة أيضاً إذا كان السيرفر يعيدها
                if (result.data.status) userData.status = result.data.status;
                localStorage.setItem('userData', JSON.stringify(userData));
            }
            window.location.href = 'profile.html';
        } else {
            // عرض رسالة الخطأ المحددة القادمة من السيرفر (مثل: "البريد الإلكتروني موجود مسبقاً")
            const errorDetail = result.errors ? Object.values(result.errors).join('\n') : (result.message || "فشل في معالجة البيانات");
            alert("Error (422): " + errorDetail);
        }
    } catch (error) {
        console.error('Error submitting brand:', error);
        alert("Server connection error.");
    }
}

// دالة لجلب وعرض البراندات الخاصة بالمستخدم المسجل في صفحته الشخصية
async function displayUserBrands(containerId = 'user-brands-list') {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        // استدعاء API لجلب براندات المستخدم (يفترض وجود ملف my-brands.php)
        const result = await FancyAPI.get('/brands/my-brands.php'); 

        if (result.status === 401) {
            localStorage.removeItem('userData'); // تنظيف البيانات القديمة
            container.innerHTML = `<p style="text-align: center; padding: 40px; grid-column: 1/-1;">Please <a href="#" class="login-link" style="color: var(--primary-color);">log in</a> to view your brands.</p>`;
            if (window.showAuthModal) window.showAuthModal('login');
            return;
        }
        
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
                                    <h3>${brand.brand_name || brand.name || 'Brand'}</h3>
                                    <p>${brand.country || ''} | ${brand.city || ''}</p>
                                    <span>${brand.brand_type || ''}</span>
                                </div>
                            </div>
                        </a>
                        <div class="brand-mgmt-btns" style="display: flex; gap: 8px; padding: 10px; border-top: 1px solid #eee; background: #fafafa;">
                            <button onclick="deactivateBrand(${brandId})" style="flex: 1; padding: 8px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; font-size: 13px; color: #666; transition: 0.3s;">Deactivate</button>
                            <button onclick="deleteBrand(${brandId})" style="flex: 1; padding: 8px; border: none; background: #d9534f; color: #fff; border-radius: 4px; cursor: pointer; font-size: 13px; transition: 0.3s;">Delete</button>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', brandHtml);
            });
        } else if (result.success) {
            container.innerHTML = `<p style="text-align: center; padding: 40px; grid-column: 1/-1;">No brands to display currently.</p>`;
        } else {
            container.innerHTML = `<p style="text-align: center; color: red; grid-column: 1/-1;">Data loading failed: ${result.message || 'Unknown error'}</p>`;
        }
    } catch (error) {
        console.error('Error fetching user brands:', error);
        container.innerHTML = '<p style="text-align: center; color: red; grid-column: 1/-1;">Error loading brand data.</p>';
    }
}

// دالة لتعطيل العلامة التجارية
async function deactivateBrand(brandId) {
    if (!confirm('Are you sure you want to deactivate this brand?')) return;
    try {
        const result = await FancyAPI.post('/brands/deactivate.php', { brand_id: brandId });
        if (result.success) {
            alert(result.message || 'Brand deactivated successfully');
            displayUserBrands(); // تحديث القائمة
        } else {
            alert(result.message || 'Disabling failed');
        }
    } catch (error) {
        console.error('Deactivate error:', error);
    }
}

// دالة لحذف العلامة التجارية
async function deleteBrand(brandId) {
    if (!confirm('Warning: Are you sure you want to delete this brand permanently? This action cannot be undone.')) return;
    try {
        const result = await FancyAPI.post('/brands/delete.php', { brand_id: brandId });
        if (result.success) {
            alert(result.message || 'Brand deleted successfully');
            displayUserBrands(); // تحديث القائمة
        } else {
            alert(result.message || 'Deletion failed');
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
        container.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">You are not allowed to access admin data.</p>';
        return;
    }

    try {
        const result = await FancyAPI.get('/admin/pending-brands.php');
        if (result.success && Array.isArray(result.data.brands)) {
            container.innerHTML = result.data.brands.length ? '' : '<p style="grid-column:1/-1; text-align:center;">No brands pending</p>';
            result.data.brands.forEach(brand => {
    container.innerHTML += `
        <div class="brand-card" style="border: 1px solid #eee; padding: 15px; border-radius: 8px;">
            <img src="${getSafeImageUrl(brand.logo)}" style="width:50px; height:50px; border-radius:50%;">
            <h3>${brand.brand_name}</h3>
            <p>${brand.brand_type} - ${brand.country}</p>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button onclick="approveBrand(${brand.id})" style="flex:1; background:#5cb85c; color:#fff; border:none; padding:8px; border-radius:4px; cursor:pointer;">accept</button>
                <button onclick="rejectBrand(${brand.id})" style="flex:1; background:#d9534f; color:#fff; border:none; padding:8px; border-radius:4px; cursor:pointer;">reject</button>
            </div>
        </div>
    `;
});
        }
    } catch (error) { console.error(error); }
}

// دالة قبول البراند
async function approveBrand(id) {
    if (!confirm('Do you want to accept this brand?')) return;
    const result = await FancyAPI.post('/admin/approve-brand.php', { brand_id: id });
    if (result.success) {
        alert('The brand has been accepted.');
        loadPendingBrandsForAdmin('pending-brands-list');
    } else {
        alert('error: ' + result.message);
    }
}

// دالة رفض البراند
async function rejectBrand(id) {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    const result = await FancyAPI.post('/admin/reject-brand.php', { brand_id: id, reason: reason });
    if (result.success) {
        alert('Brand rejected');
        loadPendingBrandsForAdmin('pending-brands-list');
    } else {
        alert('error: ' + result.message);
    }
}

// دالة إيقاف البراند (للإدارة)
async function suspendBrand(id) {
    if (!confirm('Do you want to disable this brand? The brand and its products will be hidden.')) return;
    const result = await FancyAPI.post('/admin/suspend-brand.php', { brand_id: id });
    if (result.success) {
        alert('The brand was successfully Stoped');
        location.reload();
    } else {
        alert('error: ' + result.message);
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