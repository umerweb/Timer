import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/login';
import Home from './pages/home';
import Private from './pages/private';
import Dashboard from './pages/dashbaord';


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Private> <Dashboard /> </Private>} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={ <Private> <Dashboard /> </Private> } />
       
      </Routes>
    </Router>
  );
}

export default App;