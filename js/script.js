// تعريف كائن FancyAPI لمعالجة طلبات الـ API بشكل موحد وتجنب تكرار الكود
const FancyAPI = {
    baseUrl: '/Fancy-Design/fancy/api',
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
            'X-Requested-With': 'XMLHttpRequest'
        };

        try {
            // إضافة credentials: 'include' لضمان عمل الجلسات (Sessions)
            const response = await fetch(url, { ...options, headers: defaultHeaders, credentials: 'include' });
            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (e) {
                // في حال رجوع خطأ PHP أو استجابة ليست JSON
                return { success: false, message: 'استجابة غير صالحة من السيرفر', status: response.status, error: text };
            }
            return { ok: response.ok, status: response.status, ...result };
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            return { success: false, message: 'حدث خطأ في الاتصال بالسيرفر' };
        }
    },
    get(endpoint) { return this.request(endpoint, { method: 'GET' }); },
    post(endpoint, data) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) }); }
};

// وظيفة لجلب ملف الهيدر وحقنه في الصفحة
function loadHeader() {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    // استخدام مسار يبدأ بـ / لضمان العمل من أي صفحة
    fetch('/Fancy-Design/components/header.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('لم يتم العثور على ملف الهيدر');
            }
            return response.text();
        })
        .then(data => {
            headerPlaceholder.innerHTML = data;
            // استدعاء تحديث الواجهة إذا كان ملف auth.js محلاً
            if (typeof window.initializeAuthListeners === 'function') {
                window.initializeAuthListeners(); // استدعاء دالة تهيئة المصادقة
            }
        })
        .catch(error => {
            console.error('حدث خطأ أثناء تحميل الهيدر:', error);
        });
}

// تنفيذ الوظيفة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    loadHeader();
    loadFooter();
});

// وظيفه جلب الارجل
function loadFooter() {
    fetch('/Fancy-Design/components/footer.html')
        .then(res => {
            if (!res.ok) throw new Error('فشل تحميل الفوتر');
            return res.text();
        })
        .then(data => {
            const footerPlaceholder = document.getElementById('footer-placeholder');
            if (footerPlaceholder) {
                footerPlaceholder.innerHTML = data;
            }
        })
        .catch(error => {
            console.error('حدث خطأ أثناء تحميل الفوتر:', error);
        });
}
// نستخدم هذا الكود لضمان العمل حتى لو تم تحميل الهيدر بـ fetch
document.addEventListener('click', function (e) {
    const toggle = document.getElementById('dropdown-toggle');
    const menu = document.querySelector('.dropdown-menu');
    const selectedText = document.getElementById('selected-text');

    // القائمة المنسدلة (Categories)
    if (toggle && toggle.contains(e.target)) {
        menu.classList.toggle('show');
        toggle.classList.toggle('active');
    } else if (menu && menu.contains(e.target)) {
        const listItem = e.target.closest('li');
        if (listItem) {
            selectedText.innerText = listItem.innerText;
        }
        menu.classList.remove('show');
        toggle.classList.remove('active');
    } else if (toggle) {
        menu.classList.remove('show');
        toggle.classList.remove('active');
    }
});
