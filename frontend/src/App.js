import React from "react";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";
import { createUseStyles } from "react-jss";

import Room from "./views/Room";
import Main from "./views/Main";
import NotFound from "./views/NotFound";

const useStyles = createUseStyles({
  mainContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
});

function App() {
  const classes = useStyles();
  return (
    <Router>
      <div className={classes.mainContainer}>
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
