// List of admin email addresses (must match backend)
const ADMIN_EMAILS = [
  'mancavesportscardsllc@gmail.com',
  'sparkmandrew@gmail.com',
  'cgcardsfan2011@gmail.com'
];

// Helper function to check if an email is an admin
export function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// Helper function to check if current user is admin (from token)
export function isAdminUser() {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return false;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return isAdminEmail(payload.email);
  } catch {
    return false;
  }
}

