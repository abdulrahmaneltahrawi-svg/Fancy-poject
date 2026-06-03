// تعريف كائن FancyAPI لمعالجة طلبات الـ API بشكل موحد وتجنب تكرار الكود
const FancyAPI = {
    baseUrl: '/fancy-design/Fancy/api',
    async request(endpoint, options = {}) {
        // تنظيف المسار لضمان عدم وجود سلاش مزدوج
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${this.baseUrl}${cleanEndpoint}`;
        
        console.log(`Sending ${options.method || 'GET'} request to: ${url}`);

        const headers = {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...options.headers,
        };

        // إضافة Content-Type فقط في حال كانت الطريقة ليست GET
        if (options.method && options.method !== 'GET' && !headers['Content-Type'] && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        try {
            // إضافة credentials: 'include' لضمان عمل الجلسات (Sessions)
            const response = await fetch(url, { ...options, headers, credentials: 'include' });
            const text = (await response.text()).trim();

            let result = {};
            try {
                result = text ? JSON.parse(text) : {};
            } catch (e) {
                console.error(`Invalid JSON Response at [${endpoint}]:`, text);
                const isHtml = text.trim().startsWith('<');
                const errorMsg = isHtml ? 'Path or server error (404/500)' : 'Invalid server response';
                return { success: false, message: errorMsg, status: response.status, error: text };
            }

            // تصحيح: إذا كان الرد 200 أو 201 نعتبر العملية نجحت برمجياً ما لم يذكر السيرفر عكس ذلك
            const isSuccess = (response.ok && result.success !== false) || result.success === true;
            return { ok: response.ok, status: response.status, success: isSuccess, ...result };
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            return { success: false, message: 'An error occurred while connecting to the server' };
        }
    },
    get(endpoint) { return this.request(endpoint, { method: 'GET' }); },
        post(endpoint, data) {
            const isFormData = data instanceof FormData;
            return this.request(endpoint, {
                method: 'POST',
                body: isFormData ? data : JSON.stringify(data)
            });
        }
};

// وظيفة لجلب ملف الهيدر وحقنه في الصفحة
function loadHeader() {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    // استخدام مسار يبدأ بـ / لضمان العمل من أي صفحة
    fetch('/Fancy-Design/components/header.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Header file not found');
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
            console.error('Error loading header:', error);
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
            if (!res.ok) throw new Error('Failed to load footer');
            return res.text();
        })
        .then(data => {
            const footerPlaceholder = document.getElementById('footer-placeholder');
            if (footerPlaceholder) {
                footerPlaceholder.innerHTML = data;
            }
        })
        .catch(error => {
            console.error('Error loading footer:', error);
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
