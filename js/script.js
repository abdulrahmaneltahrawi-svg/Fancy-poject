// وظيفة لجلب ملف الهيدر وحقنه في الصفحة
function loadHeader() {
    fetch('components/header.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('لم يتم العثور على ملف الهيدر');
            }
            return response.text();
        })
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        })
        .catch(error => {
            console.error('حدث خطأ أثناء تحميل الهيدر:', error);
        });
}

// تنفيذ الوظيفة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', loadHeader);


// وظيفه جلب الارجل
function loadFooter() {
    fetch('components/footer.html')
        .then(res => res.text())
        .then(data => {
            document.getElementById('footer-placeholder').innerHTML = data;
        });
}
loadFooter();





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
            const response = await fetch('api/auth/register.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const responseText = await response.text();
            let result = null;
            try {
                result = JSON.parse(responseText);
            } catch (jsonError) {
                console.error('فشل تحليل استجابة JSON. الاستجابة الخام من الخادم:', responseText);
                displayMessage('registrationMessage', 'حدث خطأ غير متوقع من الخادم. تفقد الكونسول.', false);
                return;
            }

            if (result && response.ok && result.success) {
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
            const response = await fetch('api/auth/login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText); 
            } catch (jsonError) {
                console.error('فشل تحليل استجابة JSON. الاستجابة الخام من الخادم:', responseText);
                displayMessage('loginMessage', 'حدث خطأ غير متوقع من الخادم. تفقد الكونسول.', false);
                return; // توقف هنا ولا تحاول قراءة result.success
            }

            // الآن، تعامل مع نتيجة JSON المحللة
            if (response.ok && result.success) { // تحقق مما إذا كانت حالة HTTP هي 2xx (نجاح) ونجاح منطقي من API
                displayMessage('loginMessage', result.message, true);
                localStorage.setItem('userData', JSON.stringify(result.data.user));
                // إغلاق النافذة بعد ثانية واحدة من النجاح
                setTimeout(() => { document.getElementById('authModal').classList.remove('show'); }, 1500);
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
