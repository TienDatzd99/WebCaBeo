import { Routes, Route, useLocation, matchPath } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Header from './components/Header';
import ReadingHeader from './components/ReadingHeader.jsx';
import Footer from './components/Footer';
import Home from './pages/Home';
import ComicDetail from './pages/ComicDetail';
import Reading from './pages/Reading';
import Login from './pages/Login';
import Register from './pages/Register';
import Search from './pages/Search.jsx';

/* Admin */
import AdminLayout    from './admin/AdminLayout.jsx';
import AdminDashboard from './admin/AdminDashboard.jsx';
import AdminComics    from './admin/AdminComics.jsx';
import AdminSliders   from './admin/AdminSliders.jsx';
import AdminUsers     from './admin/AdminUsers.jsx';
import AdminGenres    from './admin/AdminGenres.jsx';

function App() {
  const location = useLocation();
  const readingMatch = matchPath('/read/:id/:chapterId', location.pathname);
  const isReadingPage = Boolean(readingMatch);
  const comicId = readingMatch?.params?.id;
  const chapterId = readingMatch?.params?.chapterId;
  const chapterLabel = chapterId ? `Chương ${chapterId}` : 'Đọc truyện';

  return (
    <AuthProvider>
      <Routes>
        {/* ── Admin routes (no Header/Footer) ── */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index          element={<AdminDashboard />} />
          <Route path="comics"  element={<AdminComics />} />
          <Route path="sliders" element={<AdminSliders />} />
          <Route path="users"   element={<AdminUsers />} />
          <Route path="genres"  element={<AdminGenres />} />
        </Route>

        {/* ── Public routes ── */}
        <Route path="/*" element={
          <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
            {isReadingPage ? <ReadingHeader chapterLabel={chapterLabel} comicId={comicId} chapterId={chapterId} /> : <Header />}
            <main style={{ flex:1 }}>
              <Routes>
                <Route path="/"                    element={<Home />} />
                <Route path="/comic/:id"           element={<ComicDetail />} />
                <Route path="/read/:id/:chapterId" element={<Reading />} />
                <Route path="/login"               element={<Login />} />
                <Route path="/register"            element={<Register />} />
                <Route path="/search"              element={<Search />} />
              </Routes>
            </main>
            {!isReadingPage && <Footer />}
          </div>
        } />
      </Routes>
    </AuthProvider>
  );
}

export default App;
