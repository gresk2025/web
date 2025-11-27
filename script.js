// 1. Inicializar Iconos Lucide
lucide.createIcons();

// 2. Footer Year
document.getElementById('year-text').innerText = `© ${new Date().getFullYear()} Gabriel Razouk Resk.`;

// 3. DETECCIÓN DE FIREFOX
const isFirefox = typeof InstallTrigger !== 'undefined';

// 4. Lógica del Navbar y Menú Móvil - VERSIÓN SIMPLIFICADA
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const navbar = document.getElementById('navbar');
let isMenuOpen = false;

// SOLUCIÓN DEFINITIVA FIREFOX - MANEJO SIMPLIFICADO DEL MENÚ
function toggleMobileMenu() {
    isMenuOpen = !isMenuOpen;
    
    if (isMenuOpen) {
        // ABRIR MENÚ
        if (isFirefox) {
            // Para Firefox: usar display block/none directamente
            mobileMenu.style.display = 'block';
            mobileMenu.classList.remove('hidden');
        } else {
            // Para otros navegadores: usar clases normalmente
            mobileMenu.classList.remove('hidden');
        }
        mobileMenuBtn.innerHTML = '<i data-lucide="x" class="w-7 h-7"></i>';
    } else {
        // CERRAR MENÚ
        if (isFirefox) {
            // Para Firefox: usar display none directamente
            mobileMenu.style.display = 'none';
            mobileMenu.classList.add('hidden');
        } else {
            // Para otros navegadores: usar clases normalmente
            mobileMenu.classList.add('hidden');
        }
        mobileMenuBtn.innerHTML = '<i data-lucide="menu" class="w-7 h-7"></i>';
    }
    
    lucide.createIcons();
}

// Event listener simplificado
mobileMenuBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleMobileMenu();
});

// Cerrar menú al hacer clic fuera
document.addEventListener('click', function(e) {
    if (isMenuOpen && !mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        toggleMobileMenu();
    }
});

// Cerrar menú al redimensionar (si se abre en móvil y se cambia a desktop)
window.addEventListener('resize', function() {
    if (window.innerWidth >= 768 && isMenuOpen) {
        toggleMobileMenu();
    }
});

// 5. Scroll Effect Navbar
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('bg-slate-900/95', 'shadow-lg', 'backdrop-blur-md', 'py-3');
        navbar.classList.remove('py-5');
    } else {
        navbar.classList.remove('bg-slate-900/95', 'shadow-lg', 'backdrop-blur-md', 'py-3');
        navbar.classList.add('py-5');
    }
});

// 6. Scroll Suave a Secciones
function scrollToSection(id, event) {
    if (event) {
        event.preventDefault();
    }
    
    // Cerrar menú si está abierto
    if (isMenuOpen) {
        toggleMobileMenu();
    }

    const element = document.getElementById(id);
    if (element) {
        const navbarHeight = navbar.offsetHeight;
        const targetPosition = element.offsetTop - navbarHeight;
        
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }
    
    return false;
}

// 7. INICIALIZACIÓN PARA FIREFOX MOBILE
document.addEventListener('DOMContentLoaded', function() {
    // Verificar que las imágenes del logo estén cargadas
    const sharkLogo = document.getElementById('shark-logo');
    const navbarLogo = document.getElementById('navbar-logo');
    const footerLogo = document.getElementById('footer-logo');
    
    function handleImageError(img, defaultSrc = 'logo.png') {
        img.onerror = null;
        img.src = defaultSrc;
    }
    
    if (sharkLogo) sharkLogo.onerror = function() { handleImageError(this); };
    if (navbarLogo) navbarLogo.onerror = function() { handleImageError(this); };
    if (footerLogo) footerLogo.onerror = function() { handleImageError(this); };
    
    // CORRECCIONES ESPECÍFICAS PARA FIREFOX MOBILE
    if (isFirefox) {
        console.log('Firefox detectado - aplicando correcciones específicas');
        
        // Forzar estilos iniciales para elementos problemáticos
        const whatsappBtn = document.querySelector('a[href*="wa.me"]');
        if (whatsappBtn) {
            whatsappBtn.style.position = 'fixed';
            whatsappBtn.style.bottom = '24px';
            whatsappBtn.style.right = '24px';
            whatsappBtn.style.zIndex = '9999';
            whatsappBtn.style.opacity = '1';
            whatsappBtn.style.visibility = 'visible';
            whatsappBtn.style.display = 'block';
        }
        
        // Asegurar que el menú móvil esté oculto inicialmente
        if (mobileMenu) {
            mobileMenu.style.display = 'none';
        }
        
        // Prevenir cualquier comportamiento extraño del viewport
        document.documentElement.style.overflowX = 'hidden';
        document.body.style.overflowX = 'hidden';
    }
});

// 8. Prevenir comportamientos por defecto
document.addEventListener('DOMContentLoaded', function() {
    const links = document.querySelectorAll('a[href*="#"], button[onclick*="scrollToSection"]');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.getAttribute('href') === '#' || this.getAttribute('href') === '') {
                e.preventDefault();
            }
        });
    });
});