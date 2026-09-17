 (function () {
      "use strict";

      var ids = function (id) { return document.getElementById(id); };

      function setError(input, message) {
        if (!input) return;
        input.classList.toggle("input-error", Boolean(message));
        var error = ids(input.id + "-error");
        if (error) error.textContent = message || "";
      }

      function resetForm(form) {
        form.querySelectorAll("input").forEach(function (input) { setError(input, ""); });
        var feedback = form.querySelector(".feedback");
        if (feedback) {
          feedback.textContent = "";
          feedback.className = "feedback";
        }
      }

      function showFeedback(id, message, kind) {
        var feedback = ids(id);
        if (!feedback) return;
        feedback.textContent = message || "";
        feedback.className = "feedback" + (kind ? " " + kind : "");
      }

      async function requestJson(url, options) {
        var response = await fetch(url, Object.assign({
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin"
        }, options || {}));

        var data = {};
        try {
          data = await response.json();
        } catch (_) {}

        return { response: response, data: data };
      }

      document.querySelectorAll(".toggle-password").forEach(function (button) {
        button.addEventListener("click", function () {
          var input = ids(button.getAttribute("data-target"));
          if (!input) return;
          var showing = input.type === "text";
          input.type = showing ? "password" : "text";
          button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
        });
      });

      var login = ids("login-form");
      if (login) {
        var params = new URLSearchParams(window.location.search);
        if (params.get("created") === "1") {
          showFeedback("login-feedback", "Account created successfully. You can log in now.", "notice");
          history.replaceState({}, document.title, "index.html");
        }

        login.addEventListener("submit", async function (event) {
          event.preventDefault();
          resetForm(login);

          var email = ids("login-email");
          var password = ids("login-password");
          var valid = true;

          if (!email.value.trim()) {
            setError(email, "Email address is required.");
            valid = false;
          } else if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) {
            setError(email, "Enter a valid email address.");
            valid = false;
          }

          if (!password.value) {
            setError(password, "Password is required.");
            valid = false;
          }

          if (!valid) return;

          var submit = login.querySelector('button[type="submit"]');
          submit.disabled = true;
          submit.textContent = "Logging in…";

          try {
            var result = await requestJson("/api/auth/login", {
              method: "POST",
              body: JSON.stringify({
                email: email.value.trim(),
                password: password.value
              })
            });

            if (result.response.status === 429) {
              var retry = Number(result.data.retryAfterSeconds || 900);
              window.location.href = "rate-limit.html?retry=" + encodeURIComponent(retry);
              return;
            }

            if (!result.response.ok) {
              showFeedback(
                "login-feedback",
                result.data.message || "Login failed. Please try again.",
                "notice"
              );
              return;
            }

            window.location.href = "dashboard.html";
          } catch (error) {
            showFeedback(
              "login-feedback",
              "Cannot reach the server. Please try again.",
              "notice"
            );
          } finally {
            submit.disabled = false;
            submit.textContent = "Log In";
          }
        });
      }

      var signup = ids("signup-form");
      var passwordInput = ids("signup-password");
      var rules = ["length", "upper", "number", "symbol"];

      function passwordState(value) {
        return {
          length: value.length >= 8,
          upper: /[A-Z]/.test(value),
          number: /\d/.test(value),
          symbol: /[^A-Za-z0-9]/.test(value)
        };
      }

      function updateStrength() {
        if (!passwordInput) return;
        var state = passwordState(passwordInput.value);
        var score = rules.filter(function (name) { return state[name]; }).length;

        rules.forEach(function (name) {
          var item = document.querySelector('[data-rule="' + name + '"]');
          if (item) item.classList.toggle("met", state[name]);
        });

        var bar = ids("strength-bar");
        var label = ids("strength-label");

        if (bar) {
          bar.style.width = (score * 25) + "%";
          bar.style.background = score < 2 ? "#df887f" : score < 4 ? "#ddb25f" : "#39a278";
        }

        if (label) {
          label.textContent =
            score === 0 ? "Use a strong password" :
            score < 2 ? "Too weak" :
            score < 4 ? "Almost there" :
            "Strong password";
        }
      }

      if (passwordInput) {
        passwordInput.addEventListener("input", updateStrength);
      }

      if (signup) {
        signup.addEventListener("submit", async function (event) {
          event.preventDefault();
          resetForm(signup);

          var name = ids("signup-name");
          var email = ids("signup-email");
          var password = ids("signup-password");
          var confirm = ids("signup-confirm");
          var terms = ids("terms");
          var state = passwordState(password.value);
          var valid = true;

          if (!name.value.trim()) {
            setError(name, "Full name is required.");
            valid = false;
          }

          if (!email.value.trim() || !/^\S+@\S+\.\S+$/.test(email.value.trim())) {
            setError(email, "Enter a valid email address.");
            valid = false;
          }

          if (rules.some(function (name) { return !state[name]; })) {
            setError(password, "Complete all password requirements.");
            valid = false;
          }

          if (!confirm.value || confirm.value !== password.value) {
            setError(confirm, "Passwords do not match.");
            valid = false;
          }

          if (!terms.checked) {
            showFeedback("signup-feedback", "Please accept the Terms of Service and Privacy Policy.", "notice");
            terms.focus();
            valid = false;
          }

          if (!valid) return;

          var submit = signup.querySelector('button[type="submit"]');
          submit.disabled = true;
          submit.textContent = "Creating account…";

          try {
            var result = await requestJson("/api/auth/signup", {
              method: "POST",
              body: JSON.stringify({
                fullName: name.value.trim(),
                email: email.value.trim(),
                password: password.value,
                confirmPassword: confirm.value
              })
            });

            if (!result.response.ok) {
              showFeedback(
                "signup-feedback",
                result.data.message || "Could not create account.",
                "notice"
              );
              return;
            }

            window.location.href = "index.html?created=1";
          } catch (error) {
            showFeedback(
              "signup-feedback",
              "Cannot reach the server. Please try again.",
              "notice"
            );
          } finally {
            submit.disabled = false;
            submit.textContent = "Create account";
          }
        });
      }

      var countdown = ids("countdown");
      if (countdown) {
        var retryParams = new URLSearchParams(window.location.search);
        var secondsLeft = Number(retryParams.get("retry") || 900);

        function render() {
          var minutes = Math.floor(secondsLeft / 60);
          var seconds = secondsLeft % 60;
          countdown.textContent =
            String(minutes).padStart(2, "0") + ":" +
            String(seconds).padStart(2, "0");
        }

        render();

        window.setInterval(function () {
          if (secondsLeft > 0) {
            secondsLeft -= 1;
            render();
          }
        }, 1000);
      }

      var google = ids("google-button");
      if (google) {
        google.addEventListener("click", function () {
          window.alert("Google sign-in is not enabled yet. Email/password login is fully connected.");
        });
      }

      var forgot = ids("forgot-password-link");
      if (forgot) {
        forgot.addEventListener("click", function (event) {
          event.preventDefault();
          window.alert("Password reset email is not enabled yet.");
        });
      }

      var dashboardName = ids("dashboard-name");
      if (dashboardName) {
        (async function loadProfile() {
          try {
            var response = await fetch("/api/auth/me", {
              credentials: "same-origin"
            });

            if (!response.ok) {
              window.location.replace("index.html");
              return;
            }

            var data = await response.json();
            ids("dashboard-name").textContent = data.fullName || "";
            ids("dashboard-email").textContent = data.email || "";
          } catch (error) {
            window.location.replace("index.html");
          }
        })();
      }

      var logout = ids("logout-button");
      if (logout) {
        logout.addEventListener("click", async function () {
          logout.disabled = true;
          logout.textContent = "Logging out…";

          try {
            await fetch("/api/auth/logout", {
              method: "POST",
              credentials: "same-origin"
            });
          } finally {
            window.location.replace("index.html");
          }
        });
      }
    })();
