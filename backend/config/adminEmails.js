// List of admin email addresses
const ADMIN_EMAILS = [
  'mancavesportscardsllc@gmail.com',
  'sparkmandrew@gmail.com',
  'cgcardsfan2011@gmail.com'
];

// Helper function to check if an email is an admin
function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

module.exports = {
  ADMIN_EMAILS,
  isAdminEmail
};

