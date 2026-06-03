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

// دالة استدعاء الأقسام الفرعية بناءً على اسم القسم أو المعرف
async function loadSubCategoriesForFilter(categoryParam, callback) {
    try {
        // تحديد ما إذا كان المعرف المرسل رقماً أم نصاً لتحديد اسم المعامل (Param)
        const paramName = isNaN(categoryParam) ? 'category_name' : 'category_id';
        
        // استدعاء ملف get-sub-categories.php
        const result = await FancyAPI.get(`/categories/get-sub-categories.php?${paramName}=${encodeURIComponent(categoryParam)}`);

        // السيرفر يعيد المصفوفة داخل result.data.sub_categories وليس result.data مباشرة
        const subCategories = result.data?.sub_categories;
        if (result && result.success && Array.isArray(subCategories)) {
            if (typeof callback === 'function') {
                callback(subCategories);
            }
            return subCategories;
        } else {
            console.warn(`No sub-categories found for: ${categoryParam}`);
            return [];
        }
    } catch (error) {
        console.error('Error fetching sub-categories:', error);
        throw error;
    }
}

window.loadMainCategories = loadMainCategories;
window.loadSubCategoriesForFilter = loadSubCategoriesForFilter;
