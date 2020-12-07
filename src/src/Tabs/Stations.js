import React, {Component} from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import Snackbar from '@material-ui/core/Snackbar';
import IconButton from '@material-ui/core/IconButton';
import { ControlledEditor } from '@monaco-editor/react';

import Toolbar from '@material-ui/core/Toolbar';

import {MdClose as IconClose} from 'react-icons/md';
import {FaClipboardList as IconSelectId} from 'react-icons/fa';

import I18n from '@iobroker/adapter-react/i18n';
import Message from '@iobroker/adapter-react/Dialogs/Message';
import DialogSelectID from '@iobroker/adapter-react/Dialogs/SelectID';

const styles = theme => ({
    tab: {
        width: '100%',
        height: '100%',
        border: '3px solid #FFFFFF00',
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
        marginRight: 20
    },
    columnSettings: {
        width: 'calc(100% - 370px)',
    },
    error: {
        border: '3px solid red',
    }
});

function padding(num) {
    if (num < 10) {
        return '0' + num;
    } else {
        return num;
    }
}

class Options extends Component {
    constructor(props) {
        super(props);
        this.propertyName = 'stations';

        this.state = {
            showHint: false,
            showSelectId: false,
            toast: '',
            error: false,
            code: JSON.stringify(this.props.native[this.propertyName] || {}, null, 2)
        };
    }

    renderSelectIdDialog() {
        if (this.state.showSelectId) {
            return <DialogSelectID
                key="dialogSelect"
                imagePrefix="../.."
                dialogName={this.props.adapterName}
                themeType={this.props.themeType}
                socket={this.props.socket}
                statesOnly={true}
                onClose={() => this.setState({showSelectId: false})}
                onOk={(selected, name) => {
                    this.setState({showSelectId: false});
                    this.editor.trigger('keyboard', 'type', {text: selected});
                }}
            />;
        } else {
            return null;
        }
    }

    renderToast() {
        if (!this.state.toast) return null;
        return (
            <Snackbar
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                open={true}
                autoHideDuration={6000}
                onClose={() => this.setState({toast: ''})}
                ContentProps={{
                    'aria-describedby': 'message-id',
                }}
                message={<span id="message-id">{this.state.toast}</span>}
                action={[
                    <IconButton
                        key="close"
                        aria-label="Close"
                        color="inherit"
                        className={this.props.classes.close}
                        onClick={() => this.setState({toast: ''})}
                    >
                        <IconClose />
                    </IconButton>,
                ]}
            />);
    }

    renderHint() {
        if (this.state.showHint) {
            return (<Message text={I18n.t('Click now Get new connection certificates to request new temporary password')} onClose={() => this.setState({showHint: false})}/>);
        } else {
            return null;
        }
    }

    applyIDs(code) {
        let changed;
        if (code) {
            Object.keys(code).forEach(station =>
                code[station] && code[station].resources && Object.keys(code[station].resources).forEach(resource => {
                    if (code[station].resources[resource] && code[station].resources[resource].sensors) {
                        const sensors = code[station].resources[resource].sensors;
                        sensors.forEach((sensor, i) => {
                            if (!sensor.id) {
                                let num = i + 1;
                                const letter = resource[0].toUpperCase();
                                // eslint-disable-next-line
                                while (sensors.find(s => s.id === letter + padding(num))) {
                                    num++;
                                }
                                sensor.id = letter + padding(num);
                                changed = true;
                            }
                        });
                    }
                }));
        }

        if (changed) {
            setTimeout(() => this.setState({ code: JSON.stringify(code, null, 2) }), 100);
        }

        return code;
    }

    render() {
        const options = {
            selectOnLineNumbers: true,
        };

        return (
            <form className={this.props.classes.tab + (this.state.error ? ' ' + this.props.classes.error : '')}>
                <Toolbar variant="dense">
                    <IconButton key="select-id" aria-label="select ID"
                                title={I18n.t('Insert object ID')}
                                className={this.props.classes.toolbarButtons}
                                onClick={() => this.setState({showSelectId: true})}><IconSelectId/>
                    </IconButton>
                </Toolbar>
                <ControlledEditor
                    width="100%"
                    height="calc(100% - 48px)"
                    language="json"
                    theme={ this.props.themeType === 'dark' ? 'vs-dark': 'vs-light' }
                    value={ this.state.code }
                    options={options}
                    onChange={(ev, code) => {
                        let error = false;
                        try {
                            const codeObj = JSON.parse(code);
                            this.props.onChange(this.props.attributeName, codeObj);
                        } catch (e) {
                            error = true;
                        }
                        this.setState({code, error});
                    }}
                    editorDidMount={(_, editor) => {
                        editor.focus();
                        this.editor = editor;
                    }}
                />
                {this.renderHint()}
                {this.renderToast()}
                {this.renderSelectIdDialog()}
            </form>
        );
    }
}

Options.propTypes = {
    common: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    theme: PropTypes.object.isRequired,
    themeType: PropTypes.string,
    adapterName: PropTypes.string.isRequired,
    attributeName: PropTypes.string.isRequired,
    onError: PropTypes.func,
    onLoad: PropTypes.func,
    onChange: PropTypes.func,
    socket: PropTypes.object.isRequired,
};

export default withStyles(styles)(Options);
