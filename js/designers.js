// دالة لجلب وعرض جميع المصممين (للقائمة العامة)
async function displayAllDesigners(containerId = 'designers-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const result = await FancyAPI.get('/designer/public-list.php');
        if (result && result.success) {
            const designers = result.data.designers || [];
            container.innerHTML = designers.length ? '' : '<p>No designers found.</p>';
            
            designers.forEach(designer => {
                container.innerHTML += `
                    <div class="brand-card">
                        <a href="view_designer.html?id=${designer.id}" style="text-decoration: none; color: inherit;">
                            <div class="brand-info">
                                <img src="${getSafeImageUrl(designer.logo || designer.avatar)}" class="brand-logo" />
                                <div class="brand-text">
                                    <h3>${designer.designer_name}</h3>
                                    <p>${designer.designer_type}</p>
                                    <span>${designer.city}, ${designer.country}</span>
                                </div>
                            </div>
                        </a>
                    </div>`;
            });
        }
    } catch (error) { console.error('Error:', error); }
}

// دالة لجلب وعرض مصممي المستخدم في البروفايل
async function displayUserDesigners(containerId = 'user-designers-list') {
    const container = document.getElementById(containerId);
    const createWrapper = document.getElementById('create-section-wrapper');
    if (!container) return;

    try {
        // استدعاء ملف my_design.php الذي يجلب بيانات المصمم المسجل حالياً
        const result = await FancyAPI.get('/designer/my_design.php'); 
        
        if (result.success && result.data) {
            const designer = result.data;
            
            // إذا وجد بروفايل، نخفي زر الإضافة (+)
            if (createWrapper) createWrapper.classList.add('hidden');

            container.innerHTML = `
                <div class="brand-card" style="width: 100%; max-width: 500px; margin: 20px auto; text-align: left;">
                    <div class="brand-info">
                        <img src="${getSafeImageUrl(designer.avatar)}" class="brand-logo" style="width: 80px; height: 80px; border-radius: 50%;" />
                        <div class="brand-text">
                            <h3 style="font-size: 20px;">${designer.company_type || 'Designer Profile'}</h3>
                            <p style="color: #666; margin: 5px 0;">${designer.bio || 'No bio available'}</p>
                            <span style="color: #888; font-size: 13px;">${designer.city}, ${designer.country}</span>
                        </div>
                    </div>
                    <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px; display: flex; gap: 10px;">
                        <a href="edit-designer.html" style="flex: 1; text-align: center; background: #333; color: #fff; padding: 8px; border-radius: 4px; text-decoration: none; font-size: 14px;">Edit Profile</a>
                    </div>
                </div>`;
        } else {
            container.innerHTML = '<p style="padding: 40px; text-align: center;">You have not created a designer profile yet.</p>';
            // إظهار زر الإضافة (+) لتمكين المستخدم من إنشاء بروفايل
            if (createWrapper) createWrapper.classList.remove('hidden');
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
        const result = await FancyAPI.get('/admin/pending-designers.php');
        if (result.success && Array.isArray(result.data.designers)) {
            container.innerHTML = result.data.designers.length ? '' : '<p>No pending designers</p>';
            result.data.designers.forEach(designer => {
                container.innerHTML += `
                    <div class="brand-card" style="border: 1px solid #eee; padding: 15px; border-radius: 8px;">
                        <img src="${getSafeImageUrl(designer.logo || designer.avatar)}" style="width:50px; height:50px; border-radius:50%;">
                        <h3>${designer.designer_name}</h3>
                        <div style="display:flex; gap:10px; margin-top:10px;">
                            <button onclick="approveDesigner(${designer.id})" style="flex:1; background:#5cb85c; color:#fff; border:none; padding:8px; border-radius:4px; cursor:pointer;">Accept</button>
                            <button onclick="rejectDesigner(${designer.id})" style="flex:1; background:#d9534f; color:#fff; border:none; padding:8px; border-radius:4px; cursor:pointer;">Reject</button>
                        </div>
                    </div>`;
            });
        }
    } catch (error) { console.error(error); }
}

async function approveDesigner(id) {
    if (!confirm('Approve this designer?')) return;
    const result = await FancyAPI.post('/admin/approve-designer.php', { designer_id: id });
    if (result.success) { alert('Accepted'); location.reload(); }
}

async function rejectDesigner(id) {
    const reason = prompt('Reason:');
    if (reason === null) return;
    const result = await FancyAPI.post('/admin/reject-designer.php', { designer_id: id, reason });
    if (result.success) { alert('Rejected'); location.reload(); }
}

async function suspendDesigner(id) {
    if (!confirm('Suspend this designer?')) return;
    const result = await FancyAPI.post('/admin/suspend-designer.php', { designer_id: id });
    if (result.success) { alert('Suspended'); location.reload(); }
}

window.displayAllDesigners = displayAllDesigners;
window.displayUserDesigners = displayUserDesigners;
window.submitNewDesigner = submitNewDesigner;
window.loadPendingDesignersForAdmin = loadPendingDesignersForAdmin;
window.approveDesigner = approveDesigner;
window.rejectDesigner = rejectDesigner;
window.suspendDesigner = suspendDesigner;