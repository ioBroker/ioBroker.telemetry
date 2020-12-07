import React, {Component} from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import clsx from 'clsx';

import TextField from '@material-ui/core/TextField';

import I18n from '@iobroker/adapter-react/i18n';
import Logo from '@iobroker/adapter-react/Components/Logo';

const styles = theme => ({
    tab: {
        width: '100%',
        minHeight: '100%'
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
        marginRight: 20
    },
    columnSettings: {
        width: 'calc(100% - 370px)',
    },
    selectControl: {
        width: 200,
        paddingBottom: 20,
    }
});

class Options extends Component {
    constructor(props) {
        super(props);

        this.state = {
        };
    }

    render() {
        return <form className={this.props.classes.tab}>
            <Logo
                instance={this.props.instance}
                common={this.props.common}
                native={this.props.native}
                onError={text => this.setState({errorText: text})}
                onLoad={this.props.onLoad}
            />
            <div className={clsx(this.props.classes.column, this.props.classes.columnSettings)}>
                <TextField
                    value={this.props.native.url}
                    type="number"
                    onChange={e => this.props.onChange('url', e.target.value)}
                    label={I18n.t('URL Server')}
                    helperText={I18n.t('Server')}
                />
            </div>
        </form>;
    }
}

Options.propTypes = {
    common: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
    onError: PropTypes.func,
    onLoad: PropTypes.func,
    onChange: PropTypes.func,
    socket: PropTypes.object.isRequired,
};

export default withStyles(styles)(Options);
