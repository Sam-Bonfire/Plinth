import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Menu } from './Menu';
import { Orders } from './Orders';

export const App = (): React.JSX.Element => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/orders" element={<Orders />} />
      </Routes>
    </HashRouter>
  );
};
