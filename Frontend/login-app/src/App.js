import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import CreateAdminPage from "./components/CreateAdminPage";
import RegistrationPage from './components/RegistrationPage';
import PasswordResetRequest from './components/PasswordRequestRecuperation';
import PasswordResetPage from './components/ResetPassword';
import WelcomePage from './components/Welcome';
import UserProfile from './components/UserProfile';
import AdminProfile from './components/AdminProfile';
import RootProfile from './components/RootProfile';
import HomePage from './components/HomePage';
import SearchResults from './components/SearchResults';
import BookDetails from './components/BookDetails';
import BookListPage from './components/BookListPage'; 
import CheckoutDeliveryPage from './components/CheckoutDeliveryPage';
import CheckoutStoreSelectionPage from './components/CheckoutStoreSelectionPage';
import CheckoutPaymentPage from './components/CheckoutPaymentPage';
import CheckoutPaymentConfirmation from './components/CheckoutPaymentConfirmation';
import BookItemsList from './components/AdminProfileComponents/BookItemsList'; // Ruta corregida
import PurchaseDetailsPage from "./components/UserProfilePageComponents/PurchaseDetailsPage";

// Wrapper para el checkout para manejar más fácilmente cualquier estado compartido
const CheckoutWrapper = () => {
  return (
    <Routes>
      <Route path="/" element={<CheckoutDeliveryPage />} />
      <Route path="/store-selection" element={<CheckoutStoreSelectionPage />} />
      <Route path="/payment" element={<CheckoutPaymentPage />} />
      <Route path="/confirm-payment" element={<CheckoutPaymentConfirmation />} />
    </Routes>
  );
};

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Redirect from / to /Login */}
        <Route path="/" element={<Navigate to="/Login" replace />} />
        
        {/* Rutas públicas/autenticación */}
        <Route path="/Login" element={<LoginPage />} />
        <Route path="/CreateAdmin" element={<CreateAdminPage />} />
        <Route path="/Register" element={<RegistrationPage />} />
        <Route path="/RequestChangePassword" element={<PasswordResetRequest />} />
        <Route path="/reset-password/:token" element={<PasswordResetPage />} />
        
        {/* Ruta para la página de bienvenida (legacy) */}
        <Route path="/Welcome" element={<WelcomePage />} />
        
        {/* Rutas de checkout usando un wrapper para mejor manejo de rutas anidadas */}
        <Route path="/checkout/*" element={<CheckoutWrapper />} />

        {/* Página principal, búsqueda y detalles de libro */}
        <Route path="/Home" element={<HomePage />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/libro/:bookId" element={<BookDetails />} />
        <Route path="/Profile/purchases/:purchaseId" element={<PurchaseDetailsPage />} />
        
        {/* Nuevas rutas para categorías de libros */}
        <Route path="/libros/destacados" element={<BookListPage category="destacados" />} />
        <Route path="/libros/descuentos" element={<BookListPage category="descuentos" />} />
        <Route path="/libros" element={<BookListPage category="todos" />} />
        <Route path="/libros/categoria/:categoryName" element={<BookListPage category="categoria" />} />
        
        {/* Nueva ruta para la lista de ejemplares de un libro */}
        <Route path="/admin/libros/:id/ejemplares" element={<BookItemsList />} />
        
        {/* Rutas de perfil de usuario y administrador */}
        <Route path="/Profile" element={<UserProfile />} />
        <Route path="/AdminProfile" element={<AdminProfile />} />
        <Route path="/RootProfile" element={<RootProfile />} />
      </Routes>
    </Router>
  );
};

export default App;