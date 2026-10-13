"use strict";

/* Toggle empty park rows and redraw the last fetched admin context. */
window.DG_TOGGLE_PARK_ADMIN_EMPTY={
  toggle(state,render){
    state.setState({showEmpty:!state.getState().showEmpty});
    const context=state.getState().lastContext||{projects:[],measurements:[]};
    render(context.projects,context.measurements);
  }
};
