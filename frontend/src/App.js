import React from "react";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";

import Room from "./views/Room";
import Main from "./views/Main";
import NotFound from "./views/NotFound";

function App() {
  return (
    <Router>
      <div>
        <Switch>
          <Route exact path="/">
            <Main />
          </Route>
          <Route exact path="/:room([A-Za-z0-9]{32})">
            <Room />
          </Route>
          <Route path="*">
            <NotFound />
          </Route>
        </Switch>
      </div>
    </Router>
  );
}

export default App;
