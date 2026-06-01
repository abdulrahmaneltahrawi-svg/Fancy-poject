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

// دالة استدعاء الأقسام الفرعية بناءً على اسم القسم الرئيسي
async function loadSubCategoriesForFilter(categoryName, callback) {
    try {
        // استدعاء ملف get-sub-categories.php مع تمرير اسم القسم
        const result = await FancyAPI.get(`/categories/get-sub-categories.php?category_name=${encodeURIComponent(categoryName)}`);

        if (result && result.success && Array.isArray(result.data)) {
            if (typeof callback === 'function') {
                callback(result.data);
            }
            return result.data;
        } else {
            console.warn(`No sub-categories found for: ${categoryName}`);
            return [];
        }
    } catch (error) {
        console.error('Error fetching sub-categories:', error);
        throw error;
    }
}

window.loadMainCategories = loadMainCategories;
window.loadSubCategoriesForFilter = loadSubCategoriesForFilter;
