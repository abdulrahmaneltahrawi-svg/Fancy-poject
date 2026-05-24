/**
 * magazines.js - معالجة بيانات مجلة التصميم (Interior Projects)
 */

async function loadMagazines(containerId, limit = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">جاري تحميل المجلة...</p>';
        
        // استدعاء API المجلات
        const result = await FancyAPI.get('/magazines/list.php'); 

        if (result && result.success && Array.isArray(result.data.magazines)) {
            if (result.data.magazines.length === 0) {
                container.innerHTML = "<p style='grid-column: 1/-1; text-align: center;'>لا توجد مقالات حالياً.</p>";
                return;
            }
            
            container.innerHTML = ""; 
            let items = result.data.magazines;
            if (limit) items = items.slice(0, limit);

            items.forEach(item => {
                // نستخدم الدالة الموحدة الموجودة في index.html
                if (typeof window.createGenericCardHTML === 'function') {
                    container.innerHTML += window.createGenericCardHTML(item, 'magazine');
                }
            });
        } else {
            container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: red;">${result.message || "لا يوجد محتوى حالياً."}</p>`;
        }
    } catch (error) {
        console.error('Error fetching magazines:', error);
        container.innerHTML = "<p style='grid-column: 1/-1; text-align: center; color: red;'>حدث خطأ في تحميل بيانات المجلة.</p>";
    }
}

// جعل الدالة متاحة عالمياً
window.loadMagazines = loadMagazines;