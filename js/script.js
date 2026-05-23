// وظيفة لجلب ملف الهيدر وحقنه في الصفحة
function loadHeader() {
    // استخدام مسار يبدأ بـ / لضمان العمل من أي صفحة
    fetch('/Fancy-Design/components/header.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('لم يتم العثور على ملف الهيدر');
            }
            return response.text();
        })
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
            updateAuthUI(); // تحديث أزرار تسجيل الدخول بناءً على حالة المستخدم
        })
        .catch(error => {
            console.error('حدث خطأ أثناء تحميل الهيدر:', error);
        });
}

// وظيفة لتغيير أزرار الهيدر (Login/Join) إلى اسم المستخدم عند تسجيل الدخول
function updateAuthUI() {
    const authLinks = document.querySelector('.auth-links');
    if (!authLinks) return;

    const userData = localStorage.getItem('userData');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            authLinks.innerHTML = `
                <span style="margin-left: 15px; font-size: 14px; font-weight: 500;">أهلاً، ${user.first_name || 'مستخدم'}</span>
                <a href="#" id="logout-btn" style="color: #d9534f; font-weight: bold;">خروج</a>
            `;
        } catch (e) {
            console.error('خطأ في قراءة بيانات المستخدم:', e);
        }
    }
}

// تنفيذ الوظيفة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    loadHeader();
    loadFooter();
});

// وظيفه جلب الارجل
function loadFooter() {
    fetch('/Fancy-Design/components/footer.html')
        .then(res => res.text())
        .then(data => {
            document.getElementById('footer-placeholder').innerHTML = data;
        });
}
// نستخدم هذا الكود لضمان العمل حتى لو تم تحميل الهيدر بـ fetch
document.addEventListener('click', function (e) {
    const toggle = document.getElementById('dropdown-toggle');
    const menu = document.querySelector('.dropdown-menu');
    const selectedText = document.getElementById('selected-text');
    const modal = document.getElementById('authModal');

    // القائمة المنسدلة (Categories)
    if (toggle && toggle.contains(e.target)) {
        menu.classList.toggle('show');
        toggle.classList.toggle('active');
    } else if (menu && menu.contains(e.target) && e.target.tagName === 'LI') {
        selectedText.innerText = e.target.innerText;
        menu.classList.remove('show');
        toggle.classList.remove('active');
    } else if (toggle) {
        menu.classList.remove('show');
        toggle.classList.remove('active');
    }

    // فتح النافذة عند الضغط على Login أو Join
    if (e.target.closest('.login-link')) {
        e.preventDefault();
        showAuthModal('login');
    } else if (e.target.closest('.join-link')) {
        e.preventDefault();
        showAuthModal('register');
    }

    // معالجة الضغط على زر تسجيل الخروج
    if (e.target.id === 'logout-btn') {
        e.preventDefault();
        localStorage.removeItem('userData'); // حذف البيانات
        location.reload(); // إعادة تحميل الصفحة للعودة للحالة الأصلية
    }

    // إغلاق النافذة
    if (e.target.classList.contains('close-modal') || e.target === modal) {
        modal.classList.remove('show');
    }

    // التبديل داخل النافذة
    if (e.target.id === 'showLogin') switchAuthTab('login');
    if (e.target.id === 'showRegister') switchAuthTab('register');
});

function showAuthModal(type) {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.add('show');
    switchAuthTab(type);
}

function switchAuthTab(type) {
    const loginSec = document.getElementById('loginSection');
    const regSec = document.getElementById('registerSection');
    const loginBtn = document.getElementById('showLogin');
    const regBtn = document.getElementById('showRegister');

    if (type === 'login') {
        loginSec.classList.remove('hidden');
        regSec.classList.add('hidden');
        loginBtn.classList.add('active');
        regBtn.classList.remove('active');
    } else {
        loginSec.classList.add('hidden');
        regSec.classList.remove('hidden');
        loginBtn.classList.remove('active');
        regBtn.classList.add('active');
    }
}

// Helper function to display messages (يمكن تحسينها بعناصر واجهة مستخدم أفضل)
function displayMessage(elementId, message, isSuccess) {
    const messageDiv = document.getElementById(elementId);
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.style.color = isSuccess ? 'green' : 'red';
        messageDiv.style.marginTop = '10px';
        messageDiv.style.padding = '8px';
        messageDiv.style.border = `1px solid ${isSuccess ? 'green' : 'red'}`;
        messageDiv.style.borderRadius = '4px';
        messageDiv.style.backgroundColor = isSuccess ? '#e6ffe6' : '#ffe6e6';
    }
}

// معالجة إرسال النماذج للـ PHP باستخدام Event Delegation
document.addEventListener('submit', async (event) => {
    // معالجة إنشاء الحساب
    if (event.target.id === 'registrationForm') {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData.entries());
        try {
            const response = await fetch('/Fancy-Design/fancy/api/auth/register.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const responseText = await response.text();
            
            if (!response.ok) {
                if (response.status === 404) {
                    displayMessage('registrationMessage', 'خطأ 404: ملف api/auth/register.php غير موجود.', false);
                } else {
                    displayMessage('registrationMessage', `خطأ من الخادم: ${response.status}`, false);
                }
                console.error('Server error response:', responseText);
                return;
            }

            let result;
            try {
                result = JSON.parse(responseText);
            } catch (jsonError) {
                console.error('فشل تحليل JSON:', responseText);
                displayMessage('registrationMessage', 'استجابة الخادم ليست JSON صالح.', false);
                return;
            }

            if (result && result.success) {
                displayMessage('registrationMessage', result.message, true);
                event.target.reset();
            } else if (result) {
                // هذا يغطي:
                // 1. response.ok هي false (حالة خطأ HTTP مثل 400, 401, 500)
                // 2. response.ok هي true، ولكن result.success هي false (مثل خطأ التحقق من الصحة)
                const errorMessage = result.message || 'حدث خطأ غير معروف.';
                const errorCode = result.data && result.data.code ? ` (${result.data.code})` : '';
                displayMessage('registrationMessage', errorMessage + errorCode, false);
            }
        } catch (error) {
            displayMessage('registrationMessage', 'حدث خطأ أثناء الاتصال بالخادم. تفقد الكونسول لمزيد من التفاصيل.', false);
            console.error('Network or server error during registration:', error);
        }
    }
    // معالجة تسجيل الدخول
    if (event.target.id === 'loginForm') {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData.entries());
        try {
            const response = await fetch('/Fancy-Design/fancy/api/auth/login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const responseText = await response.text();

            let result;
            try {
                result = JSON.parse(responseText); 
            } catch (jsonError) {
                if (!response.ok) {
                    displayMessage('loginMessage', `خطأ في الخادم (${response.status})`, false);
                } else {
                    displayMessage('loginMessage', 'استجابة الخادم غير صالحة.', false);
                }
                console.error('Error parsing response:', responseText);
                return;
            }

            if (result.success) {
                displayMessage('loginMessage', result.message, true);
                localStorage.setItem('userData', JSON.stringify(result.data.user));
                // إغلاق النافذة بعد ثانية واحدة من النجاح
                setTimeout(() => { 
                    location.reload(); // إعادة تحميل الصفحة لتحديث حالة الهيدر
                }, 1500);
            } else {
                const errorMessage = result.message || 'حدث خطأ غير معروف.';
                const errorCode = result.data && result.data.code ? ` (${result.data.code})` : '';
                displayMessage('loginMessage', errorMessage + errorCode, false);
            }
        } catch (error) {
            displayMessage('loginMessage', 'حدث خطأ أثناء الاتصال بالخادم. تفقد الكونسول لمزيد من التفاصيل.', false);
            console.error('Network or server error during login:', error);
        }
    }
});
