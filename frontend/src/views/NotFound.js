import React from "react";
import { Link } from "react-router-dom";

const NotFound = () => (
  <div>
    <p>404 - Not Found!</p>
    <Link to="/">Go Home</Link>
  </div>
);

export default NotFound;
