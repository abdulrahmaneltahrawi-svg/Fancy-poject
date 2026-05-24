/**
 * categories.js - معالجة بيانات الأقسام (Categories)
 */

async function loadMainCategories(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        // استدعاء API الأقسام من السيرفر
        const result = await FancyAPI.get('/categories/list.php');

        if (result && result.success && Array.isArray(result.data.categories)) {
            container.innerHTML = ""; 
            result.data.categories.forEach(cat => {
                const a = document.createElement('a');
                // توجيه الروابط بناءً على وجود صفحات فلترة جاهزة في المشروع
                const existingPages = ['Furniture', 'Decore', 'Finishes'];
                a.href = existingPages.includes(cat.name) ? `filter_${cat.name}.html` : "#";
                a.textContent = cat.name;
                
                // التعامل مع الروابط التي لم تكتمل صفحاتها بعد (تظهر رسالة تنبيه)
                if (a.getAttribute('href') === "#") {
                    a.onclick = (e) => {
                        e.preventDefault();
                        alert("لم يتم اضافة منتجات في الوقت الحالي لهذه الفئة");
                    };
                }
                container.appendChild(a);
            });
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

window.loadMainCategories = loadMainCategories;
