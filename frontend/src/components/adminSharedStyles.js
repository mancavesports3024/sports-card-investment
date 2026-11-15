// One shared CSS entry for admin routes so webpack's mini-css-extract-plugin
// sees a single import order across lazy chunks (CI treats order warnings as errors).
import './TCDBBrowser.css';
import './AdminCardDatabase.css';
