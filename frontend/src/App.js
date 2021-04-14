import React from "react";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";

import { Main } from "grommet";

import Room from "./views/Room";
import { Main as MainView } from "./views/Main";
import NotFound from "./views/NotFound";

function App() {
  return (
    <Router>
      <Main>
        <Switch>
          <Route exact path="/">
            <MainView />
          </Route>
          <Route
            exact
            path="/:room([A-Za-z0-9ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ-]{6,32})"
          >
            <Room />
          </Route>
          <Route path="*">
            <NotFound />
          </Route>
        </Switch>
      </Main>
    </Router>
  );
}

export default App;
