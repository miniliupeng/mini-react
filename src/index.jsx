const { render} = window.MiniReact;

function App() {
  const count = 1
  return <div>
    <p>{count}</p>
    <button>加一</button>
  </div>;
}

render(<App/>, document.getElementById('root'));