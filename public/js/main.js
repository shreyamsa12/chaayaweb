document.addEventListener('DOMContentLoaded', () => {
    // Brand switching logic
    const hostname = window.location.hostname;
    const isChaya = hostname.startsWith('chaya.');
    
    // Update branding
    if (isChaya) {
        // Update logo
        const logoImg = document.querySelector('.logo img');
        if (logoImg) {
            logoImg.src = '/assets/chaya.png';
            logoImg.alt = 'Chaya Logo';
        }
        
        // Update all text instances of "Photoshooto" to "Chaya"
        document.body.innerHTML = document.body.innerHTML.replace(/Photoshooto/g, 'Chaya');
        
        // Update page title
        document.title = document.title.replace('Photoshooto', 'Chaya');
    }

    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');

    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
            navMenu.classList.remove('active');
        }
    });

    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
                navMenu.classList.remove('active');
            }
        });
    });

    // Add scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all sections for scroll animations
    document.querySelectorAll('section').forEach(section => {
        observer.observe(section);
    });

    // Add hover effects to cards
    const cards = document.querySelectorAll('.feature-card, .benefit-card, .process-card, .testimonial-card, .pricing-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.classList.add('hover');
        });
        card.addEventListener('mouseleave', () => {
            card.classList.remove('hover');
        });
    });

    // Animate testimonials
    let currentTestimonial = 0;
    const testimonials = document.querySelectorAll('.testimonial-card');
    
    function rotateTestimonials() {
        testimonials.forEach((testimonial, index) => {
            testimonial.style.opacity = index === currentTestimonial ? '1' : '0.3';
            testimonial.style.transform = index === currentTestimonial ? 'scale(1.05)' : 'scale(1)';
        });
        currentTestimonial = (currentTestimonial + 1) % testimonials.length;
    }

    setInterval(rotateTestimonials, 5000);
    rotateTestimonials();

    // Form validation and submission
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(contactForm);
            const submitButton = contactForm.querySelector('button[type="submit"]');
            
            // Simulate form submission
            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';
            
            setTimeout(() => {
                submitButton.textContent = 'Message Sent!';
                submitButton.classList.add('success');
                contactForm.reset();
                
                setTimeout(() => {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Send Message';
                    submitButton.classList.remove('success');
                }, 3000);
            }, 1500);
        });
    }

    // Add counter animation to pricing
    const prices = document.querySelectorAll('.price');
    prices.forEach(price => {
        const value = price.textContent;
        if (value.includes('₹')) {
            const number = parseInt(value.replace(/[^0-9]/g, ''));
            let count = 0;
            const duration = 2000;
            const increment = number / (duration / 16);
            
            const counter = setInterval(() => {
                count += increment;
                if (count >= number) {
                    price.innerHTML = value;
                    clearInterval(counter);
                } else {
                    price.innerHTML = '₹' + Math.floor(count) + 
                        (value.includes('/photo') ? '<span>/photo</span>' : 
                         value.includes('/year') ? '<span>/year</span>' : 
                         '<span> to join</span>');
                }
            }, 16);
        }
    });

    // Add parallax effect to sections
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        document.querySelectorAll('.parallax').forEach(element => {
            const speed = element.dataset.speed || 0.5;
            element.style.transform = `translateY(${scrolled * speed}px)`;
        });
    });
}); 