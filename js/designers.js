// دالة لجلب وعرض جميع المصممين (للقائمة العامة)
async function displayAllDesigners(containerId = 'designers-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        // تم تغيير المسار ليتوافق مع الملف الموجود: All_designer.php
        const result = await FancyAPI.get('/admin/All_designer.php');
        if (result && result.success) {
            const designers = result.data || []; // البيانات تعود مباشرة في المصفوفة حسب ملف All_designer.php
            container.innerHTML = designers.length ? '' : '<p>No designers found.</p>';
            
            designers.forEach(designer => {
                container.innerHTML += `
                    <div class="brand-card">
                        <a href="view_designer.html?id=${designer.id}" style="text-decoration: none; color: inherit;">
                            <div class="brand-info">
                                <img src="${getSafeImageUrl(designer.avatar)}" class="brand-logo" />
                                <div class="brand-text">
                                    <h3>${designer.user_name}</h3>
                                    <p>${designer.company_type || 'Professional Designer'}</p>
                                    <span>${designer.city}, ${designer.country}</span>
                                </div>
                            </div>
                        </a>
                    </div>`;
            });
        }
    } catch (error) { console.error('Error:', error); }
}

// دالة إرسال بيانات مصمم جديد
async function submitNewDesigner(formData) {
    try {
        const result = await FancyAPI.post('/designer/create_designer.php', formData);
        if (result.success) {
            alert('Designer profile created successfully! It will be reviewed.');
            window.location.href = 'profile.html';
        } else {
            alert('Error: ' + (result.message || 'Failed to create profile.'));
        }
    } catch (error) { console.error('Error:', error); }
}

// دالة جلب المصممين المعلقين للمدير
async function loadPendingDesignersForAdmin(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const result = await FancyAPI.get('/admin/pending_designer.php');
        if (result.success && Array.isArray(result.data)) {
            container.innerHTML = result.data.length ? '' : '<p>No pending designers</p>';
            result.data.forEach(designer => {
                container.innerHTML += `
                    <div class="brand-card" style="border: 1px solid #eee; padding: 15px; border-radius: 8px;">
                        <img src="${getSafeImageUrl(designer.avatar)}" style="width:50px; height:50px; border-radius:50%;">
                        <h3>${designer.user_name}</h3>
                        <div style="display:flex; gap:10px; margin-top:10px;">
                            <button onclick="approveDesignerAction(${designer.id})" style="flex:1; background:#5cb85c; color:#fff; border:none; padding:8px; border-radius:4px; cursor:pointer;">Accept</button>
                            <button onclick="rejectDesignerAction(${designer.id})" style="flex:1; background:#d9534f; color:#fff; border:none; padding:8px; border-radius:4px; cursor:pointer;">Reject</button>
                        </div>
                    </div>`;
            });
        }
    } catch (error) { console.error(error); }
}

// تم تغيير أسماء الدوال لتجنب التعارض مع الأسماء المحجوزة
async function approveDesignerAction(id) {
    if (!confirm('Approve this designer?')) return;
    // لاحظ استخدام FormData لأن الملف يتوقع $_POST['designer_id']
    const formData = new FormData();
    formData.append('designer_id', id);
    const result = await FancyAPI.post('/admin/Approve_designer.php', formData);
    if (result.success) { alert('Accepted'); location.reload(); }
}

async function rejectDesignerAction(id) {
    if (!confirm('Reject this designer?')) return;
    const formData = new FormData();
    formData.append('designer_id', id);
    const result = await FancyAPI.post('/admin/rejected_designer.php', formData);
    if (result.success) { alert('Rejected'); location.reload(); }
}

async function suspendDesigner(id) {
    if (!confirm('Suspend this designer?')) return;
    const result = await FancyAPI.post('/admin/suspend-designer.php', { designer_id: id });
    if (result.success) { alert('Suspended'); location.reload(); }
}

// دالة لجلب وعرض بيانات المصمم للمستخدم المسجل
async function displayUserDesignerProfile(containerId = 'user-designers-list') {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const result = await FancyAPI.get('/designer/my_design.php');

        if (result.status === 401) {
            if (window.showAuthModal) window.showAuthModal('login');
            return;
        }

        // إذا لم يكن لديه حساب مصمم بعد
        if (result.status === 404) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; grid-column: 1/-1;">
                    <p style="color: #666; margin-bottom: 20px;">You haven't created a designer profile yet.</p>
                    <a href="add-designer.html" class="header-action-btn" style="display: inline-block; text-decoration: none;">Create Designer Profile</a>
                </div>`;
            return;
        }

        if (result.success && result.data) {
            const designer = result.data;

            // إذا وجد بروفايل، نخفي زر الإضافة (+) في صفحة البروفايل لمنع التكرار
            const createWrapper = document.getElementById('create-section-wrapper');
            if (createWrapper) createWrapper.classList.add('hidden');

            container.innerHTML = `
                <div class="designer-profile-card" style="grid-column: 1/-1; max-width: 800px; margin: 0 auto; background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 25px; text-align: left;">
                    <div style="display: flex; align-items: center; gap: 20px; border-bottom: 1px solid #f5f5f5; padding-bottom: 20px; margin-bottom: 20px;">
                        <img src="${getSafeImageUrl(designer.avatar_url || designer.avatar)}" alt="Avatar" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #f0f0f0;">
                        <div>
                            <h2 style="margin: 0; font-size: 24px;">${designer.company_type || 'Designer'}</h2>
                            <p style="margin: 5px 0; color: #666;">${designer.city}, ${designer.country}</p>
                            <span style="display: inline-block; padding: 3px 10px; background: #e8f5e9; color: #2e7d32; border-radius: 4px; font-size: 12px; font-weight: bold;">Status: ${designer.status}</span>
                        </div>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin-bottom: 10px;">Bio:</h4>
                        <p style="line-height: 1.6; color: #444;">${designer.bio || 'No bio provided.'}</p>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin-bottom: 10px;">Services:</h4>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            ${designer.services ? designer.services.map(s => `<span style="background: #f0f0f0; padding: 5px 12px; border-radius: 20px; font-size: 13px; color: #555;">${s.name}</span>`).join('') : '<p>No services listed.</p>'}
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 30px;">
                        <a href="view_designer.html?id=${designer.id}" class="header-action-btn" style="flex: 1; text-align: center; text-decoration: none;">View Public Page</a>
                        <a href="edit-designer.html?id=${designer.id}" class="header-action-btn outline" style="flex: 1; text-align: center; text-decoration: none;">Edit Designer Info</a>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `<p style="text-align: center; color: red;">Failed to load designer data: ${result.message}</p>`;
        }
    } catch (error) {
        console.error('Error fetching designer profile:', error);
        container.innerHTML = '<p style="text-align: center; color: red;">Error connecting to the server.</p>';
    }
}

window.displayAllDesigners = displayAllDesigners;
window.submitNewDesigner = submitNewDesigner;
window.loadPendingDesignersForAdmin = loadPendingDesignersForAdmin;
window.approveDesigner = approveDesignerAction;
window.rejectDesigner = rejectDesignerAction;
window.suspendDesigner = suspendDesigner;
window.displayUserDesignerProfile = displayUserDesignerProfile;
window.displayUserDesigners = displayUserDesignerProfile; // Alias for compatibility