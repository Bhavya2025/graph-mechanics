import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PageTransition } from './components/PageTransition';
import { Game } from './screens/Game';
import { Home } from './screens/Home';
import { LevelSelect } from './screens/LevelSelect';

export default function App() {
  return (
    <BrowserRouter>
      <div className="h-screen w-screen overflow-hidden">
        <Routes>
          <Route
            path="/"
            element={
              <PageTransition>
                <Home />
              </PageTransition>
            }
          />
          <Route
            path="/levels"
            element={
              <PageTransition>
                <LevelSelect />
              </PageTransition>
            }
          />
          <Route
            path="/play/:levelId"
            element={
              <PageTransition>
                <Game />
              </PageTransition>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
