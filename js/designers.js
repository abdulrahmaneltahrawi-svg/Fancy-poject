/**
 * designers.js - جلب وعرض بيانات المصممين
 */

async function displayDesigners() {
    const container = document.getElementById('designers-container');
    if (!container) return;

    try {
        // جلب البيانات من API المصممين
        const result = await FancyAPI.get('/designer/get-profile.php');

        if (result.ok && result.success && Array.isArray(result.data)) {
            container.innerHTML = '';
            result.data.forEach(designer => {
                const html = `
                    <div class="designer-card">
                        <img src="${designer.image || 'imges/img/fancy1.jfif'}" alt="${designer.name}" class="designer-img">
                        <div class="designer-info">
                            <h3>${designer.name}</h3>
                            <p>${designer.specialization || 'Interior Designer'}</p>
                            <a href="designer_details.html?id=${designer.id}" class="btn-profile">View Profile</a>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });
        } else {
            container.innerHTML = `<p>${result.message || 'No designers found.'}</p>`;
        }
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<p>Error loading designers.</p>';
    }
}

async function submitDesignerProfile(data) {
    try {
        // إرسال البيانات إلى API إنشاء ملف المصمم
        const result = await FancyAPI.post('/designer/create-profile.php', data);
        if (result.success) {
            alert(result.message || "تم حفظ الملف الشخصي بنجاح! هو الآن بانتظار مراجعة الإدارة.");
            window.location.href = 'profile.html';
        } else {
            alert("خطأ: " + (result.message || "فشل في حفظ البيانات"));
        }
    } catch (error) {
        console.error('Error submitting designer profile:', error);
        alert("حدث خطأ في الاتصال بالسيرفر.");
    }
}

// التشغيل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    displayDesigners();
});

window.submitDesignerProfile = submitDesignerProfile;