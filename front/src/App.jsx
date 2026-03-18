import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/login';
import Home from './pages/home';
import Private from './pages/private';
import Dashboard from './pages/dashbaord';
import TimerEditPage from "./pages/TimerEditPage";
import Pricing from "./pages/pricing";
import Plan from "./pages/Select-plan";
import BillingSuccess from "./pages/billing-success";



function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Private> <Dashboard /> </Private>} />
        <Route path="/login" element={<Login />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/billing/success" element={<BillingSuccess />} />
        <Route path="/select-plan" element={<Plan />} />
        <Route path="/dashboard" element={ <Private> <Dashboard /> </Private> } />
        <Route path="/timer/:id" element={ <Private> <TimerEditPage /> </Private> } />
       
      </Routes>
    </Router>
  );
}

export default App;