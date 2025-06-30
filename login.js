document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const statusMessage = document.getElementById('statusMessage');
    const submitButton = loginForm.querySelector('button[type="submit"]');

    function displayMessage(message, type = 'error') {
        statusMessage.textContent = message;
        statusMessage.className = type;
        statusMessage.style.display = 'block';
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = 'Logging in...';
        statusMessage.style.display = 'none';

        const formData = new FormData(loginForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                // Successful login, redirect to the main form
                window.location.href = '/'; 
            } else {
                const errorResult = await response.json();
                throw new Error(errorResult.message || 'Login failed.');
            }
        } catch (error) {
            displayMessage(error.message, 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Login';
        }
    });
});